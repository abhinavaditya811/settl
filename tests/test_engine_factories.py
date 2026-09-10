"""Engine collaborator construction (api/engine_factories.py) - specifically the
demo-tenant send guard, which is orthogonal to the per-trigger-source sender
split already covered by state.py/test_api.py. Without this guard, a visitor
on the public /demo page (no login required) could trigger a real send just by
clicking "Approve & Send" whenever SETTL_LIVE_SEND is armed."""

from datetime import date, timedelta
from decimal import Decimal

import settl.api.identity as identity_mod
from settl.api import engine_factories as factories
from settl.compliance.gate import ComplianceResult, GateDecision
from settl.schema.invoice import Channel, Invoice, InvoiceStatus, Source
from settl.sending.base import SendOutcome

PASS = ComplianceResult(GateDecision.PASS, [], "clear")


def _invoice(tenant_id: str, phone: str | None = None) -> Invoice:
    today = date.today()
    return Invoice(
        invoice_id="INV-1", tenant_id=tenant_id, source=Source.CSV, source_ref="x",
        amount_due=Decimal("100.00"), currency="USD",
        issue_date=today - timedelta(days=40), due_date=today - timedelta(days=10),
        status=InvoiceStatus.OPEN, debtor_name="Acme", debtor_email="a@b.co",
        debtor_phone=phone, is_b2b=True, late_fee_allowed=True, as_of_date=today,
    )


class _FakeSender:
    def __init__(self):
        self.calls: list[str] = []

    def send(self, invoice, message, compliance, channel=None):
        self.calls.append(invoice.invoice_id)
        return SendOutcome(sent=True, detail="real")


def test_demo_tenant_never_reaches_the_real_sender(monkeypatch):
    monkeypatch.delenv("SETTL_LIVE_SEND_DEMO", raising=False)
    monkeypatch.setattr(identity_mod, "demo_tenant_ids", lambda: frozenset({"t_demo_1"}))
    real = _FakeSender()
    guarded = factories.guard_demo_tenants(real, log=None)
    out = guarded.send(_invoice("t_demo_1"), "hi", PASS, Channel.EMAIL)
    assert real.calls == []  # never reached
    assert out.sent is True and "would send" in out.detail  # MockSender's own text


def test_non_demo_tenant_reaches_the_real_sender(monkeypatch):
    monkeypatch.delenv("SETTL_LIVE_SEND_DEMO", raising=False)
    monkeypatch.setattr(identity_mod, "demo_tenant_ids", lambda: frozenset({"t_demo_1"}))
    real = _FakeSender()
    guarded = factories.guard_demo_tenants(real, log=None)
    out = guarded.send(_invoice("t_real_tenant"), "hi", PASS, Channel.EMAIL)
    assert real.calls == ["INV-1"]
    assert out.detail == "real"


def test_settl_live_send_demo_opts_out_of_the_guard(monkeypatch):
    # No SETTL_DEMO_* pair configured - falls back to the shared sender.
    monkeypatch.setenv("SETTL_LIVE_SEND_DEMO", "1")
    for var in ("SETTL_DEMO_SMTP_USER", "SETTL_DEMO_SMTP_APP_PASSWORD", "SETTL_DEMO_TEST_RECIPIENT"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setattr(identity_mod, "demo_tenant_ids", lambda: frozenset({"t_demo_1"}))
    real = _FakeSender()
    guarded = factories.guard_demo_tenants(real, log=None)
    guarded.send(_invoice("t_demo_1"), "hi", PASS, Channel.EMAIL)
    assert real.calls == ["INV-1"]  # opted in - demo data can go live too


def test_settl_live_send_demo_uses_its_own_from_to_when_configured(monkeypatch):
    # A demo-specific from/to pair keeps demo test sends out of the SAME inbox
    # used for real invoice testing.
    monkeypatch.setenv("SETTL_LIVE_SEND_DEMO", "1")
    monkeypatch.setenv("SETTL_DEMO_SMTP_USER", "demo-sender@gmail.com")
    monkeypatch.setenv("SETTL_DEMO_SMTP_APP_PASSWORD", "app-pw")
    monkeypatch.setenv("SETTL_DEMO_TEST_RECIPIENT", "demo-inbox@gmail.com")
    real = _FakeSender()
    guarded = factories.guard_demo_tenants(real, log=None)
    assert real.calls == []  # not even touched at construction time
    assert guarded is not real  # a distinct, demo-specific sender was used instead


def test_is_live_sees_through_the_demo_guard_to_the_real_sender(monkeypatch):
    from settl.sending import GmailSmtpSender

    monkeypatch.delenv("SETTL_LIVE_SEND_DEMO", raising=False)
    monkeypatch.setattr(identity_mod, "demo_tenant_ids", lambda: frozenset({"t_demo_1"}))
    live_sender = GmailSmtpSender(user="me@gmail.com", app_password="pw")
    guarded = factories.guard_demo_tenants(live_sender, log=None)
    assert factories.is_live(guarded) is True  # unwrapped, not the wrapper itself
    assert factories.is_live(_FakeSender()) is False


# --- channel routing (the voice seam) ------------------------------------------


def test_voice_channel_routes_to_the_mock_voice_sender(monkeypatch):
    # Without this routing, a VOICE decision silently fell through to the email
    # sender (which hard-codes emailing debtor_email regardless of channel).
    monkeypatch.delenv("SETTL_LIVE_SEND", raising=False)
    monkeypatch.delenv("SETTL_LIVE_SEND_VOICE", raising=False)
    sender = factories.make_sender(log=None)
    out = sender.send(_invoice("t_x", phone="+15551234567"), "hi", PASS, Channel.VOICE)
    assert out.sent is True and "would CALL +15551234567" in out.detail


def test_written_channels_still_reach_the_written_sender(monkeypatch):
    monkeypatch.delenv("SETTL_LIVE_SEND", raising=False)
    sender = factories.make_sender(log=None)
    out = sender.send(_invoice("t_x"), "hi", PASS, Channel.EMAIL)
    assert out.sent is True and "would send" in out.detail  # MockSender, not voice


def test_demo_tenant_voice_call_still_shows_as_a_call(monkeypatch):
    # The demo guard's mock fallback routes channels too - a demo-tenant call
    # renders "would CALL", it doesn't collapse into a generic "would send".
    monkeypatch.delenv("SETTL_LIVE_SEND_DEMO", raising=False)
    monkeypatch.setattr(identity_mod, "demo_tenant_ids", lambda: frozenset({"t_demo_1"}))
    guarded = factories.guard_demo_tenants(_FakeSender(), log=None)
    out = guarded.send(_invoice("t_demo_1", phone="+15551234567"), "hi", PASS, Channel.VOICE)
    assert "would CALL +15551234567" in out.detail


def test_live_voice_needs_flag_plus_test_number_plus_retell_config(monkeypatch):
    from settl.voice.retell_sender import RetellVoiceSender
    from settl.voice.sender import MockVoiceSender

    for var in ("SETTL_LIVE_SEND_VOICE", "SETTL_TEST_CALL_NUMBER",
                "RETELL_API_KEY", "RETELL_FROM_NUMBER", "RETELL_AGENT_ID"):
        monkeypatch.delenv(var, raising=False)
    # Default: mock, no matter what Retell config exists.
    assert isinstance(factories._make_voice_sender(None), MockVoiceSender)

    # Flag alone isn't enough - without the forced test recipient, a live dial
    # could ring a real debtor on fabricated consent. Stays mock.
    monkeypatch.setenv("SETTL_LIVE_SEND_VOICE", "1")
    assert isinstance(factories._make_voice_sender(None), MockVoiceSender)

    # Flag + test number, but Retell unconfigured → still mock.
    monkeypatch.setenv("SETTL_TEST_CALL_NUMBER", "+15550001111")
    monkeypatch.setattr("settl.voice.retell_sender.load_dotenv", lambda: {})
    assert isinstance(factories._make_voice_sender(None), MockVoiceSender)

    # All three present → the live Retell sender, redirecting every dial.
    monkeypatch.setenv("RETELL_API_KEY", "key_x")
    monkeypatch.setenv("RETELL_FROM_NUMBER", "+14150000000")
    monkeypatch.setenv("RETELL_AGENT_ID", "agent_x")
    live = factories._make_voice_sender(None)
    assert isinstance(live, RetellVoiceSender)
    assert live._force_recipient == "+15550001111"
    assert live._ledger is not None  # double-click → withheld, never a second ring


def test_demo_guard_mock_branch_never_uses_the_live_voice_sender(monkeypatch):
    # Even with live voice fully armed, a demo-tenant invoice stays on the mock
    # voice sender - a public /demo visitor must not be able to place real calls.
    monkeypatch.delenv("SETTL_LIVE_SEND_DEMO", raising=False)
    monkeypatch.setenv("SETTL_LIVE_SEND_VOICE", "1")
    monkeypatch.setenv("SETTL_TEST_CALL_NUMBER", "+15550001111")
    monkeypatch.setenv("RETELL_API_KEY", "key_x")
    monkeypatch.setenv("RETELL_FROM_NUMBER", "+14150000000")
    monkeypatch.setenv("RETELL_AGENT_ID", "agent_x")
    monkeypatch.setattr(identity_mod, "demo_tenant_ids", lambda: frozenset({"t_demo_1"}))
    guarded = factories.guard_demo_tenants(_FakeSender(), log=None)
    out = guarded.send(_invoice("t_demo_1", phone="+15551234567"), "hi", PASS, Channel.VOICE)
    assert "would CALL" in out.detail  # mock, not Retell


def test_is_live_sees_through_channel_routing_too(monkeypatch):
    # make_sender now wraps the written sender in channel routing; is_live must
    # still detect a live Gmail sender through BOTH wrappers (guard + routing).
    monkeypatch.delenv("SETTL_LIVE_SEND_DEMO", raising=False)
    monkeypatch.setenv("SETTL_LIVE_SEND", "1")
    monkeypatch.setenv("SETTL_SMTP_USER", "me@gmail.com")
    monkeypatch.setenv("SETTL_SMTP_APP_PASSWORD", "pw")
    monkeypatch.setattr(identity_mod, "demo_tenant_ids", lambda: frozenset())
    guarded = factories.make_guarded_sender(log=None)
    assert factories.is_live(guarded) is True
    monkeypatch.delenv("SETTL_LIVE_SEND")
    assert factories.is_live(factories.make_guarded_sender(log=None)) is False


# --- reply drafter (Gemini seam for inbound auto-replies) ----------------------


def test_make_reply_drafter_uses_gemini_when_armed(monkeypatch):
    from settl.agents.drafting.reply_model import GeminiReplyModel, NoOpReplyModel

    monkeypatch.setenv("SETTL_USE_GEMINI", "0")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    assert isinstance(factories.make_reply_drafter(log=None)._model, NoOpReplyModel)

    monkeypatch.setenv("SETTL_USE_GEMINI", "1")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    assert isinstance(factories.make_reply_drafter(log=None)._model, GeminiReplyModel)
