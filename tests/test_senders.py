"""Senders share one guarantee: never act on a message the gate didn't clear.

Covers the mock sender, the real Gmail sender (SMTP mocked - no network, no creds),
and the orchestrator's human-approval action (the only path a first-contact message
can legitimately reach the sender)."""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from settl.audit import ExecutionLog
from settl.compliance.gate import ComplianceResult, GateDecision
from settl.compliance.rules import RuleViolation
from settl.orchestrator import Orchestrator, TerminalState
from settl.schema.invoice import Channel, Invoice, InvoiceStatus, Source
from settl.sending import GmailSmtpSender, MissingCredentials, MockSender

PASS = ComplianceResult(GateDecision.PASS, [], "clear")
BLOCK = ComplianceResult(
    GateDecision.ESCALATE, [RuleViolation("LEGAL_THREAT", "bad")], "blocked"
)


def _invoice(contact="ap@acme.test", b2b=True, prior=None,
             payment_link="https://buy.stripe.com/test_t1"):
    today = date.today()
    return Invoice(
        invoice_id="T-1", tenant_id="t_test", source=Source.CSV, source_ref="x",
        amount_due=Decimal("100.00"), currency="USD",
        issue_date=today - timedelta(days=40), due_date=today - timedelta(days=10),
        status=InvoiceStatus.OPEN, debtor_name="Acme", debtor_email=contact,
        is_b2b=b2b, late_fee_allowed=True, prior_contacts=prior or [],
        payment_link=payment_link, as_of_date=today,
    )


# --- the shared refusal guarantee -------------------------------------------


def test_mock_sender_refuses_on_escalate():
    out = MockSender().send(_invoice(), "hi", BLOCK, Channel.EMAIL)
    assert out.sent is False and "WITHHELD" in out.detail


def test_mock_sender_sends_on_pass():
    out = MockSender().send(_invoice(), "hi", PASS, Channel.EMAIL)
    assert out.sent is True and "would send" in out.detail


# --- payment-link resolution (SCHEMA.md §5) ----------------------------------


def test_sender_substitutes_payment_link_after_gate():
    inv = _invoice(payment_link="https://buy.stripe.com/test_xyz")
    out = MockSender().send(inv, "Pay here: {{payment_link}}", PASS, Channel.EMAIL)
    assert out.sent is True
    assert "https://buy.stripe.com/test_xyz" in out.detail
    assert "{{payment_link}}" not in out.detail  # placeholder must be gone


def test_sender_hard_fails_when_link_unresolvable():
    inv = _invoice(payment_link=None)  # no invoice link, no mint, no tenant default
    out = MockSender().send(inv, "Pay here: {{payment_link}}", PASS, Channel.EMAIL)
    assert out.sent is False
    assert "unresolved payment link" in out.detail


def test_sender_falls_back_to_tenant_default_link():
    inv = _invoice(payment_link=None)
    out = MockSender(default_payment_link="https://buy.stripe.com/test_default").send(
        inv, "Pay here: {{payment_link}}", PASS, Channel.EMAIL
    )
    assert out.sent is True
    assert "test_default" in out.detail


def test_gmail_sender_refuses_on_escalate_without_touching_smtp(monkeypatch):
    # Even with no creds and no network, an ESCALATE must never attempt a send.
    def explode(*a, **k):  # pragma: no cover - must not be called
        raise AssertionError("SMTP must not be opened on an escalated message")

    monkeypatch.setattr("smtplib.SMTP_SSL", explode)
    out = GmailSmtpSender(user="x@gmail.com", app_password="pw").send(
        _invoice(), "hi", BLOCK, Channel.EMAIL
    )
    assert out.sent is False


def test_gmail_sender_requires_credentials_on_pass(monkeypatch):
    # Hermetic: ignore any real .env creds present on the dev machine.
    monkeypatch.delenv("SETTL_SMTP_USER", raising=False)
    monkeypatch.delenv("SETTL_SMTP_APP_PASSWORD", raising=False)
    sender = GmailSmtpSender(user=None, app_password=None)
    assert sender.configured is False
    with pytest.raises(MissingCredentials):
        sender.send(_invoice(), "hi", PASS, Channel.EMAIL)


def test_gmail_sender_sends_on_pass_with_mocked_smtp(monkeypatch):
    sent = {}

    class FakeSMTP:
        def __init__(self, host, port): sent["host"] = host
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def login(self, u, p): sent["login"] = u
        def send_message(self, msg): sent["to"] = msg["To"]; sent["subj"] = msg["Subject"]

    monkeypatch.setattr("smtplib.SMTP_SSL", FakeSMTP)
    sender = GmailSmtpSender(
        user="me@gmail.com", app_password="pw", force_recipient="me@gmail.com"
    )
    out = sender.send(_invoice(contact="ap@acme.test"), "pay please", PASS, Channel.EMAIL)
    assert out.sent is True
    assert sent["to"] == "me@gmail.com"  # redirected away from the synthetic debtor
    assert "redirected" in out.detail
    assert sent["host"] == "smtp.gmail.com"


# --- human approval action ---------------------------------------------------


def test_approve_and_send_clears_first_contact_only():
    log = ExecutionLog()
    orch = Orchestrator(log=log, sender=MockSender(log=log))
    inv = _invoice(prior=[])  # first contact → would be held for approval
    res = orch.approve_and_send(inv, "A friendly reminder with your link.", Channel.EMAIL)
    assert res.terminal_state is TerminalState.SENT


def test_approve_and_send_refuses_when_a_real_rule_remains():
    log = ExecutionLog()
    orch = Orchestrator(log=log, sender=MockSender(log=log))
    inv = _invoice(prior=[])
    # A legal threat is a real violation - human approval cannot override it.
    res = orch.approve_and_send(inv, "Pay now or we will sue you.", Channel.EMAIL)
    assert res.terminal_state is TerminalState.ESCALATED


def test_approve_and_send_refuses_consumer_debt():
    log = ExecutionLog()
    orch = Orchestrator(log=log, sender=MockSender(log=log))
    inv = _invoice(b2b=False, prior=[])  # consumer debt → B2B_ONLY remains
    res = orch.approve_and_send(inv, "A friendly reminder.", Channel.EMAIL)
    assert res.terminal_state is TerminalState.ESCALATED
