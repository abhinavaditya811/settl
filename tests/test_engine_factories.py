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


def _invoice(tenant_id: str) -> Invoice:
    today = date.today()
    return Invoice(
        invoice_id="INV-1", tenant_id=tenant_id, source=Source.CSV, source_ref="x",
        amount_due=Decimal("100.00"), currency="USD",
        issue_date=today - timedelta(days=40), due_date=today - timedelta(days=10),
        status=InvoiceStatus.OPEN, debtor_name="Acme", debtor_email="a@b.co",
        is_b2b=True, late_fee_allowed=True, as_of_date=today,
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
