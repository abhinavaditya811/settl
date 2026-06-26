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
    ReconcileAgent,
    ReconcileStatus,
    reconcile_payment,
    record_fee,
)
from settl.audit import ExecutionLog
from settl.schema.invoice import Invoice, InvoiceStatus, Source


def _inv(amount="1000.00", iid="INV-R", currency="USD") -> Invoice:
    today = date.today()
    return Invoice(
        invoice_id=iid, tenant_id="t_demo", source=Source.STRIPE, source_ref="x",
        amount_due=Decimal(amount), currency=currency, issue_date=today, due_date=today,
        status=InvoiceStatus.OPEN, debtor_name="Acme", debtor_email="a@b.co",
        is_b2b=True, late_fee_allowed=True, as_of_date=today,
    )


def _pay(iid, amount):
    return PaymentEvent(invoice_id=iid, amount=Decimal(amount), occurred_on=date.today())


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


def test_unpaid_does_not_record_a_fee_or_stop():
    agent = ReconcileAgent()
    outcome = agent.reconcile(_inv(), [])
    assert outcome.status is ReconcileStatus.UNPAID
    assert outcome.stop_loop is False
    assert outcome.fee is None
