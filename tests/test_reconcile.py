"""Reconcile agent - Phase 1: full payment closes the loop, records a fee, notifies.

The pure payment logic, the non-custodial fee record, and the agent's PAID path are
covered here; partial/unpaid are asserted at the classification level so the later
phases have a baseline.
"""

from datetime import date
from decimal import Decimal

from settl.agents.reconcile import (
    OperatorNotifier,
    PaymentEvent,
    PaymentEventKind,
    ReconcileAgent,
    ReconcileStatus,
    reconcile_payment,
    record_fee,
)
from settl.audit import ExecutionLog
from settl.orchestrator import next_touch_after_reconcile
from settl.schema.invoice import Invoice, InvoiceStatus, Source


def _inv(amount="1000.00", iid="INV-R", currency="USD") -> Invoice:
    today = date.today()
    return Invoice(
        invoice_id=iid, tenant_id="t_demo", source=Source.STRIPE, source_ref="x",
        amount_due=Decimal(amount), currency=currency, issue_date=today, due_date=today,
        status=InvoiceStatus.OPEN, debtor_name="Acme", debtor_email="a@b.co",
        is_b2b=True, late_fee_allowed=True, as_of_date=today,
    )


def _pay(iid, amount, currency="USD", ref=""):
    return PaymentEvent(
        invoice_id=iid, amount=Decimal(amount), occurred_on=date.today(),
        currency=currency, reference=ref,
    )


def _refund(iid, amount, ref=""):
    return PaymentEvent(
        invoice_id=iid, amount=Decimal(amount), occurred_on=date.today(),
        kind=PaymentEventKind.REFUND, reference=ref,
    )


def _dispute(iid, ref="dp_1"):
    return PaymentEvent(
        invoice_id=iid, amount=Decimal("1000.00"), occurred_on=date.today(),
        kind=PaymentEventKind.DISPUTE, reference=ref,
    )


# --- pure classification ------------------------------------------------------


def test_full_payment_is_paid():
    inv = _inv("1000.00")
    status, recovered = reconcile_payment(inv, [_pay("INV-R", "1000.00")])
    assert status is ReconcileStatus.PAID and recovered == Decimal("1000.00")


def test_overpayment_is_paid():
    inv = _inv("1000.00")
    status, _ = reconcile_payment(inv, [_pay("INV-R", "1200.00")])
    assert status is ReconcileStatus.PAID


def test_partial_payment_is_partial():
    inv = _inv("1000.00")
    status, recovered = reconcile_payment(inv, [_pay("INV-R", "400.00")])
    assert status is ReconcileStatus.PARTIAL and recovered == Decimal("400.00")


def test_no_payment_is_unpaid():
    assert reconcile_payment(_inv(), [])[0] is ReconcileStatus.UNPAID


def test_events_for_other_invoices_are_ignored():
    inv = _inv("1000.00", iid="INV-R")
    status, _ = reconcile_payment(inv, [_pay("INV-OTHER", "1000.00")])
    assert status is ReconcileStatus.UNPAID


# --- fee record (records, never collects) -------------------------------------


def test_fee_is_recorded_at_the_configured_pct():
    fee = record_fee(_inv("1000.00"), Decimal("1000.00"), 7.5)
    assert fee.fee_amount == Decimal("75.00")
    assert fee.recovered_amount == Decimal("1000.00")
    assert "not collected" in fee.note  # non-custodial


# --- the agent: PAID closes the loop, records, notifies -----------------------


def test_paid_records_fee_stops_loop_and_notifies():
    log = ExecutionLog()
    sent = []
    notifier = OperatorNotifier(log=log, email_fn=lambda to, subj, body: sent.append((to, subj, body)))
    agent = ReconcileAgent(log=log, success_fee_pct=10.0, notifier=notifier)

    inv = _inv("2000.00")
    outcome = agent.reconcile(inv, [_pay("INV-R", "2000.00")])

    assert outcome.status is ReconcileStatus.PAID
    assert outcome.stop_loop is True
    assert outcome.fee.fee_amount == Decimal("200.00")  # 10% of 2000
    # logged + operator notified
    assert any(e.agent == "reconcile" and e.decision == "paid" for e in log.entries)
    assert any(e.agent == "reconcile_notify" for e in log.entries)
    assert sent and "INV-R" in sent[0][1]


def test_demo_tenant_notification_is_logged_but_not_emailed(monkeypatch):
    # Regression: the OperatorNotifier is a SEPARATE email path from the debtor
    # sender - on every restart the replay of persisted payment events re-fired a
    # batch of "[Settl] Recovered / Needs review" emails for the ~25 synthetic
    # seed invoices, spamming the operator's own inbox.
    monkeypatch.delenv("SETTL_LIVE_SEND_DEMO", raising=False)
    log = ExecutionLog()
    sent = []
    notifier = OperatorNotifier(
        log=log, email_fn=lambda to, subj, body: sent.append((to, subj, body)),
        demo_tenant_ids=frozenset({"t_demo"}),
    )
    ReconcileAgent(log=log, notifier=notifier).reconcile(_inv("2000.00"), [_pay("INV-R", "2000.00")])
    assert sent == []  # no email for a demo tenant
    assert any(e.agent == "reconcile_notify" for e in log.entries)  # still logged


def test_demo_notification_emails_when_opted_in(monkeypatch):
    monkeypatch.setenv("SETTL_LIVE_SEND_DEMO", "1")
    log = ExecutionLog()
    sent = []
    notifier = OperatorNotifier(
        log=log, email_fn=lambda to, subj, body: sent.append((to, subj, body)),
        demo_tenant_ids=frozenset({"t_demo"}),
    )
    ReconcileAgent(log=log, notifier=notifier).reconcile(_inv("2000.00"), [_pay("INV-R", "2000.00")])
    assert sent and "INV-R" in sent[0][1]  # opted in - demo notice goes out


def test_non_demo_tenant_still_notifies():
    log = ExecutionLog()
    sent = []
    notifier = OperatorNotifier(
        log=log, email_fn=lambda to, subj, body: sent.append((to, subj, body)),
        demo_tenant_ids=frozenset({"t_other"}),  # t_demo is NOT demo here
    )
    ReconcileAgent(log=log, notifier=notifier).reconcile(_inv("2000.00"), [_pay("INV-R", "2000.00")])
    assert sent and "INV-R" in sent[0][1]


def test_unpaid_does_not_record_a_fee_or_stop():
    agent = ReconcileAgent()
    outcome = agent.reconcile(_inv(), [])
    assert outcome.status is ReconcileStatus.UNPAID
    assert outcome.stop_loop is False
    assert outcome.fee is None


# --- edge cases: refunds, disputes, currency, dedup, overpayment --------------


def test_refund_nets_a_paid_invoice_back_to_partial():
    # Paid in full, then a refund lands: net drops below due → PARTIAL, no special code.
    inv = _inv("1000.00")
    events = [_pay("INV-R", "1000.00", ref="pi_1"), _refund("INV-R", "400.00", ref="ch_1")]
    status, net = reconcile_payment(inv, events)
    assert status is ReconcileStatus.PARTIAL and net == Decimal("600.00")


def test_full_refund_reverts_to_unpaid():
    inv = _inv("1000.00")
    events = [_pay("INV-R", "1000.00", ref="pi_1"), _refund("INV-R", "1000.00", ref="ch_1")]
    assert reconcile_payment(inv, events)[0] is ReconcileStatus.UNPAID


def test_dispute_escalates_and_stops_the_loop():
    agent = ReconcileAgent()
    outcome = agent.reconcile(_inv("1000.00"), [_pay("INV-R", "1000.00"), _dispute("INV-R")])
    assert outcome.status is ReconcileStatus.DISPUTED
    assert outcome.escalate is True and outcome.stop_loop is True


def test_currency_mismatch_is_an_anomaly_never_summed():
    # A EUR payment against a USD invoice is unusable data → escalate, do not act.
    inv = _inv("1000.00", currency="USD")
    outcome = ReconcileAgent().reconcile(inv, [_pay("INV-R", "1000.00", currency="EUR")])
    assert outcome.status is ReconcileStatus.ANOMALY
    assert outcome.escalate is True and outcome.amount_recovered == Decimal("0")


def test_duplicate_reference_is_deduped():
    # A webhook + a poll reporting the same payment must not double-count.
    inv = _inv("1000.00")
    dup = [_pay("INV-R", "600.00", ref="pi_1"), _pay("INV-R", "600.00", ref="pi_1")]
    status, net = reconcile_payment(inv, dup)
    assert status is ReconcileStatus.PARTIAL and net == Decimal("600.00")


def test_partial_records_proportional_fee_and_carries_balance():
    agent = ReconcileAgent(success_fee_pct=10.0)
    outcome = agent.reconcile(_inv("1000.00"), [_pay("INV-R", "400.00")])
    assert outcome.status is ReconcileStatus.PARTIAL
    assert outcome.stop_loop is False
    assert outcome.fee.fee_amount == Decimal("40.00")  # 10% of the 400 recovered
    assert outcome.remaining_balance == Decimal("600.00")


def test_overpayment_fee_is_capped_at_the_invoice_total():
    # Debtor overpays; our fee is on the invoice amount, never the surplus.
    fee = record_fee(_inv("1000.00"), Decimal("1200.00"), 10.0)
    assert fee.fee_amount == Decimal("100.00")  # 10% of 1000, not 1200


# --- loop closure driven by reconcile -----------------------------------------


def _paid_result():
    from settl.orchestrator.result import PipelineResult, TerminalState
    return PipelineResult(invoice_id="INV-R", terminal_state=TerminalState.SENT)


def test_loop_stops_on_paid_and_chases_residual_on_partial():
    r = _paid_result()
    paid = ReconcileAgent().reconcile(_inv("1000.00"), [_pay("INV-R", "1000.00")])
    partial = ReconcileAgent().reconcile(_inv("1000.00"), [_pay("INV-R", "400.00")])

    assert next_touch_after_reconcile(r, paid).requeue is False
    d = next_touch_after_reconcile(r, partial)
    assert d.requeue is True and d.escalate is False


def test_loop_escalates_and_stops_on_dispute():
    r = _paid_result()
    disp = ReconcileAgent().reconcile(_inv("1000.00"), [_pay("INV-R", "1000.00"), _dispute("INV-R")])
    d = next_touch_after_reconcile(r, disp)
    assert d.requeue is False and d.escalate is True
