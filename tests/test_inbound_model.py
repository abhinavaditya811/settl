"""GeminiInboundClassifierModel (agents/inbound/model.py) - structured-output
parsing, fail-safe regex fallback, and low-confidence escalation. No real
network call - client is a fake mirroring test_drafting.py's pattern."""

from datetime import date, timedelta
from decimal import Decimal

from settl.agents.inbound import InboundLane
from settl.agents.inbound.model import GeminiInboundClassifierModel, _ClassificationOutput
from settl.schema.invoice import Invoice, InvoiceStatus, Source


def _invoice() -> Invoice:
    today = date.today()
    return Invoice(
        invoice_id="INV-900", tenant_id="t_demo", source=Source.STRIPE, source_ref="x",
        amount_due=Decimal("500.00"), currency="USD",
        issue_date=today - timedelta(days=40), due_date=today - timedelta(days=10),
        status=InvoiceStatus.OPEN, debtor_name="Acme", debtor_email="ap@acme.test",
        is_b2b=True, late_fee_allowed=True, as_of_date=today,
    )


class _FakeResp:
    def __init__(self, parsed):
        self.parsed = parsed


class _FakeModels:
    def __init__(self, *, parsed=None, error=None):
        self._parsed, self._error = parsed, error

    def generate_content(self, **kwargs):
        if self._error:
            raise self._error
        return _FakeResp(self._parsed)


class _FakeClient:
    def __init__(self, *, parsed=None, error=None):
        self.models = _FakeModels(parsed=parsed, error=error)


def test_gemini_classifier_is_failsafe_without_a_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    model = GeminiInboundClassifierModel(client=_FakeClient(error=AssertionError("must not call")))
    result = model.classify(_invoice(), "I dispute this charge")
    assert result.lane is InboundLane.DISPUTE  # regex backstop still runs, no key needed


def test_gemini_classifier_returns_the_parsed_lane(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    parsed = _ClassificationOutput(lane="opt_out", confidence=0.95, reasoning="asked to stop emails")
    model = GeminiInboundClassifierModel(client=_FakeClient(parsed=parsed))
    result = model.classify(_invoice(), "please don't send me such emails")
    assert result.lane is InboundLane.OPT_OUT
    assert result.confidence == 0.95
    assert result.reasoning == "asked to stop emails"


def test_gemini_classifier_escalates_low_confidence(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    parsed = _ClassificationOutput(lane="benign", confidence=0.3, reasoning="unclear intent")
    model = GeminiInboundClassifierModel(client=_FakeClient(parsed=parsed))
    result = model.classify(_invoice(), "hmm ok")
    assert result.lane is InboundLane.ESCALATE_LOW_CONFIDENCE
    assert "0.30" in result.reasoning


def test_gemini_classifier_falls_back_to_regex_on_api_error(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    model = GeminiInboundClassifierModel(client=_FakeClient(error=RuntimeError("boom")))
    result = model.classify(_invoice(), "can I get a payment plan?")
    assert result.lane is InboundLane.PAYMENT_PLAN_REQUEST  # regex backstop


def test_gemini_classifier_falls_back_on_unexpected_response_shape(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    model = GeminiInboundClassifierModel(client=_FakeClient(parsed=None))
    result = model.classify(_invoice(), "unsubscribe")
    assert result.lane is InboundLane.OPT_OUT  # regex backstop catches it anyway
