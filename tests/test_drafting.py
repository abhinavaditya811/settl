"""Drafting agent: prompt building, the offline default, and the safety invariant.

The headline test is adversarial: a model that strays into a legal threat or
consumer-debt phrasing is ESCALATED by the compliance gate, never sent. The gate,
not the LLM, decides — proven both at the gate directly and end-to-end through the
orchestrator.
"""

from datetime import date
from decimal import Decimal

import pytest

from settl.agents.drafting import (
    DraftedMessage,
    DraftingAgent,
    GeminiDraftModel,
    NoOpDraftModel,
    NoOpGrounding,
    VertexSearchGrounding,
    VoiceContext,
    build_prompt,
)
from settl.agents.strategy.policy import Action, Tone, decide_strategy
from settl.audit.execution_log import ExecutionLog
from settl.compliance import ComplianceGate
from settl.compliance.gate import GateDecision
from settl.orchestrator import Orchestrator, TerminalState
from settl.schema.invoice import (
    Channel,
    ContactDirection,
    Invoice,
    InvoiceStatus,
    PriorContact,
    Source,
)


def _invoice(*, late_fee=True, prior=None) -> Invoice:
    return Invoice(
        invoice_id="INV-T1",
        tenant_id="t_test",
        source=Source.CSV,
        source_ref="CSV-T1",
        amount_due=Decimal("1500.00"),
        currency="USD",
        issue_date=date(2026, 5, 1),
        due_date=date(2026, 6, 1),
        status=InvoiceStatus.OPEN,
        debtor_name="Acme LLC",
        debtor_email="ap@acme.co",
        is_b2b=True,
        late_fee_allowed=late_fee,
        payment_link="https://buy.stripe.com/test_inv_t1",
        prior_contacts=prior or [],
        as_of_date=date(2026, 6, 25),  # 24 days overdue → FIRM, late fee applies
    )


def _repeat_invoice() -> Invoice:
    """Clean B2B repeat payer: not first contact, so the gate won't hold for approval."""
    return _invoice(
        prior=[
            PriorContact(
                occurred_on=date(2026, 6, 5),
                direction=ContactDirection.OUTBOUND,
                channel=Channel.EMAIL,
                summary="first reminder",
            )
        ]
    )


class _ThreatModel:
    """An adversarial model that emits a legal threat — the gate must catch it."""

    name = "adversarial"

    def generate(self, prompt) -> str:
        return "Pay now or we will sue you and send this to collections."


class _FakeGrounding:
    def lookup(self, invoice) -> VoiceContext:
        return VoiceContext(snippets=["We sign off with 'Cheers, the team'."], tone_hint="warm")


# --- prompt building (pure) ---------------------------------------------------


def test_prompt_carries_the_chase_facts():
    inv = _repeat_invoice()
    decision = decide_strategy(inv)
    text = build_prompt(inv, decision).as_model_input()
    assert "Acme LLC" in text
    assert "INV-T1" in text
    assert "1500.00" in text
    assert decision.tone.value in text  # FIRM


def test_prompt_toggles_the_late_fee_instruction():
    with_fee = decide_strategy(_repeat_invoice())
    assert with_fee.include_late_fee
    assert "late fee may apply" in build_prompt(_repeat_invoice(), with_fee).as_model_input()

    no_fee_inv = _invoice(late_fee=False, prior=_repeat_invoice().prior_contacts)
    no_fee = decide_strategy(no_fee_inv)
    assert "Do not mention any late fee" in build_prompt(no_fee_inv, no_fee).as_model_input()


def test_prompt_bakes_in_the_compliance_guardrails():
    inv = _repeat_invoice()
    text = build_prompt(inv, decide_strategy(inv)).as_model_input()
    assert "Never threaten legal action" in text
    assert "Never give legal advice" in text


def test_safe_fallback_clears_the_gate():
    inv = _repeat_invoice()
    msg = build_prompt(inv, decide_strategy(inv)).safe_fallback()
    result = ComplianceGate().evaluate(inv, msg)
    assert result.decision is GateDecision.PASS


# --- the drafting agent -------------------------------------------------------


def test_agent_returns_a_drafted_message_with_metadata_and_logs():
    inv = _repeat_invoice()
    log = ExecutionLog()
    msg = DraftingAgent(log=log).draft(inv, decide_strategy(inv))
    assert isinstance(msg, DraftedMessage)
    assert msg.source == "template"  # NoOpDraftModel default
    assert msg.channel == Channel.EMAIL.value
    assert msg.includes_late_fee is True
    assert msg.grounded is False
    assert any(e.agent == "drafting" for e in log.entries)


def test_grounding_marks_the_draft_as_grounded():
    inv = _repeat_invoice()
    agent = DraftingAgent(grounding=_FakeGrounding())
    assert agent.draft(inv, decide_strategy(inv)).grounded is True
    # ...and the voice context reaches the model prompt.
    block = VoiceContext(snippets=["x"]).as_prompt_block()
    assert block and NoOpGrounding().lookup(inv).is_empty


# --- the safety invariant: the gate decides, not the LLM ----------------------


def test_gate_escalates_a_threatening_draft_directly():
    inv = _repeat_invoice()
    bad = DraftingAgent(model=_ThreatModel()).draft(inv, decide_strategy(inv))
    result = ComplianceGate().evaluate(inv, bad.text)
    assert result.decision is GateDecision.ESCALATE
    assert "LEGAL_THREAT" in result.codes


def test_adversarial_model_is_escalated_end_to_end_not_sent():
    # INV-018 is a clean repeat payer that normally SENDs; a threatening model
    # must flip it to ESCALATED, never SENT.
    from settl.data import load_synthetic_invoices

    inv018 = next(i for i in load_synthetic_invoices() if i.invoice_id == "INV-018")
    orch = Orchestrator(drafter=DraftingAgent(model=_ThreatModel()))
    res = orch.run_one(inv018)
    assert res.terminal_state is TerminalState.ESCALATED


def test_default_orchestrator_drafts_and_sends_a_clean_repeat():
    from settl.data import load_synthetic_invoices

    inv018 = next(i for i in load_synthetic_invoices() if i.invoice_id == "INV-018")
    res = Orchestrator().run_one(inv018)
    assert res.terminal_state is TerminalState.SENT
    assert res.message is not None
    assert any(step.agent == "drafting" for step in res.steps)


# --- Gemini drafting (the visible AI): wired + fail-safe ----------------------


class _FakeResp:
    def __init__(self, text):
        self.text = text


class _FakeModels:
    def __init__(self, text=None, error=None):
        self._text, self._error = text, error

    def generate_content(self, **kwargs):
        if self._error:
            raise self._error
        return _FakeResp(self._text)


class _FakeClient:
    def __init__(self, *, text=None, error=None):
        self.models = _FakeModels(text=text, error=error)


def test_grounding_live_seam_is_unimplemented():
    # Vertex grounding is still a deferred seam; drafting generation is now wired.
    with pytest.raises(NotImplementedError):
        VertexSearchGrounding().lookup(_repeat_invoice())


def test_gemini_draft_is_failsafe_without_a_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.setattr("settl.agents.drafting.model.load_dotenv", lambda *a, **k: {})
    prompt = build_prompt(_repeat_invoice(), decide_strategy(_repeat_invoice()))
    # No key -> never calls out; returns the deterministic fallback.
    model = GeminiDraftModel(client=_FakeClient(error=AssertionError("must not call")))
    assert model.generate(prompt) == prompt.safe_fallback()


def test_gemini_draft_returns_model_text(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    inv = _repeat_invoice()
    prompt = build_prompt(inv, decide_strategy(inv))
    text = "Hi Acme LLC, a quick reminder. Settle here: {{payment_link}}. Thanks!"
    assert GeminiDraftModel(client=_FakeClient(text=text)).generate(prompt) == text


def test_gemini_draft_is_failsafe_on_api_error(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    prompt = build_prompt(_repeat_invoice(), decide_strategy(_repeat_invoice()))
    model = GeminiDraftModel(client=_FakeClient(error=RuntimeError("boom")))
    assert model.generate(prompt) == prompt.safe_fallback()
