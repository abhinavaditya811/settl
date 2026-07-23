"""Canonical reconcile events + outcome (Week 4).

Reconcile is event-sourced so it never trusts ``invoice.status``: it re-derives the
real state from payment (and later, reply) events. The events are a canonical shape;
a synthetic loader produces them for tests/offline, a Stripe poll or **webhook**
produces them live - the agent reasons only over this shape, same boundary as the
Invoice adapters.

Because reconcile re-derives net paid over the **full** event log every run, reversals
fall out for free: a REFUND or DISPUTE event lowers net paid, status drops PAID→PARTIAL
(or escalates), and the recorded fee shrinks. No stateful "un-pay" code is needed - the
same "verify status, never trust" invariant that governs invoices governs payments.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from enum import Enum

from settl.agents.reconcile.fee import FeeRecord


class PaymentEventKind(str, Enum):
    """What a normalized money event represents against an invoice."""

    PAYMENT = "payment"  # money received → adds to net paid
    REFUND = "refund"  # money returned to the debtor → subtracts from net paid
    DISPUTE = "dispute"  # chargeback opened → escalate + stop the loop
    REPLY = "reply"  # inbound debtor reply → escalate (dispute/payment-plan)


class ReconcileStatus(str, Enum):
    PAID = "paid"  # settled in full → stop the loop, record the fee
    PARTIAL = "partial"  # some paid, balance remains → chase the residual
    UNPAID = "unpaid"  # nothing detected → re-queue for the next touch
    REPLY = "reply"  # an inbound reply/dispute → escalate, stop the loop
    DISPUTED = "disputed"  # a chargeback → escalate, stop the loop
    ANOMALY = "anomaly"  # unusable data (currency mismatch) → escalate, never act
    # An active PaymentPlan (SCHEMA.md §8) is behind its own schedule - paid less
    # than the cumulative amount due by as_of_date. Deliberately NOT in
    # ESCALATING_STATUSES: a missed installment is reminder-first
    # (agents/payment_plan/monitor.py), not an immediate hard escalate like a
    # dispute/chargeback/anomaly.
    INSTALLMENT_OVERDUE = "installment_overdue"


# Statuses that must route to a human and stop the autonomous loop.
ESCALATING_STATUSES = frozenset(
    {ReconcileStatus.REPLY, ReconcileStatus.DISPUTED, ReconcileStatus.ANOMALY}
)


@dataclass(frozen=True)
class PaymentEvent:
    """One money event observed against an invoice, normalized from any processor.

    ``amount`` is always a positive magnitude; ``kind`` gives it direction (a REFUND
    subtracts, a DISPUTE/REPLY escalates). ``reference`` is the processor id and doubles
    as the idempotency key - reconcile dedups on it so a webhook and a poll that report
    the same money can never double-count.
    """

    invoice_id: str
    amount: Decimal
    occurred_on: date
    currency: str = "USD"
    kind: PaymentEventKind = PaymentEventKind.PAYMENT
    source: str = "manual"  # "manual" | "stripe" | "synthetic" | "webhook"
    reference: str = ""  # processor id (payment intent / charge / dispute), dedup key


@dataclass(frozen=True)
class ReconcileOutcome:
    """What reconcile decided for one invoice this run."""

    status: ReconcileStatus
    stop_loop: bool  # True → the unpaid loop ends here
    amount_recovered: Decimal
    fee: FeeRecord | None = None
    remaining_balance: Decimal = Decimal(0)  # residual to chase on the next touch
    escalate: bool = False  # True → route to a human (dispute / reply / anomaly)
    reasoning: str = ""
