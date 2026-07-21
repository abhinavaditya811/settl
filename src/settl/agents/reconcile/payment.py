"""Pure payment reconciliation: (invoice, events) → status + recovered amount.

Re-derives the truth from observed money events; never trusts ``invoice.status``. No
side effects, no SDK - unit-testable in isolation. Every run recomputes net paid over
the **full** event log, so refunds and chargebacks reverse automatically (net drops,
status follows) without any stateful bookkeeping.

Guards, in order of severity:
  * **currency mismatch** (a payment/refund in a currency other than the invoice's) is
    unusable data → ANOMALY, escalate, never act on a bad number.
  * **dispute** (a chargeback) → DISPUTED, escalate + stop.
  * otherwise classify by net paid: PAID (≥ due) / PARTIAL (> 0) / UNPAID.
Events are deduped by ``reference`` so a webhook and a poll reporting the same money
can never double-count.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date
from decimal import Decimal

from settl.agents.payment_plan.models import PaymentPlan
from settl.agents.reconcile.events import (
    PaymentEvent,
    PaymentEventKind,
    ReconcileStatus,
)
from settl.schema.invoice import Invoice


@dataclass(frozen=True)
class PaymentTally:
    """The netted view of an invoice's money events."""

    net_paid: Decimal  # payments - refunds
    gross_paid: Decimal  # payments only
    refunded: Decimal  # refunds only
    has_dispute: bool  # a chargeback/reply event is present
    currency_mismatch: bool  # an event's currency differs from the invoice's
    remaining: Decimal  # max(amount_due - net_paid, 0)


def _dedup(events: list[PaymentEvent]) -> list[PaymentEvent]:
    """Drop repeat events sharing a non-empty ``reference`` (idempotency).

    A blank reference (hand-entered / synthetic) is never treated as a duplicate.
    """
    seen: set[tuple[str, str]] = set()
    out: list[PaymentEvent] = []
    for e in events:
        if e.reference:
            key = (e.kind.value, e.reference)
            if key in seen:
                continue
            seen.add(key)
        out.append(e)
    return out


def tally_events(invoice: Invoice, events: list[PaymentEvent]) -> PaymentTally:
    """Net an invoice's money events into a single, currency-guarded view."""
    mine = _dedup([e for e in events if e.invoice_id == invoice.invoice_id])

    gross = Decimal(0)
    refunded = Decimal(0)
    has_dispute = False
    currency_mismatch = False

    for e in mine:
        if e.kind in (PaymentEventKind.PAYMENT, PaymentEventKind.REFUND):
            if e.currency.upper() != invoice.currency.upper():
                currency_mismatch = True  # unusable number - don't fold it into the sum
                continue
        if e.kind is PaymentEventKind.PAYMENT:
            gross += e.amount
        elif e.kind is PaymentEventKind.REFUND:
            refunded += e.amount
        else:  # DISPUTE / REPLY
            has_dispute = True

    net = gross - refunded
    remaining = invoice.amount_due - net
    if remaining < 0:
        remaining = Decimal(0)
    return PaymentTally(
        net_paid=net,
        gross_paid=gross,
        refunded=refunded,
        has_dispute=has_dispute,
        currency_mismatch=currency_mismatch,
        remaining=remaining,
    )


def classify(invoice: Invoice, tally: PaymentTally) -> ReconcileStatus:
    """Map a tally onto a reconcile status. Data problems and disputes escalate first."""
    if tally.currency_mismatch:
        return ReconcileStatus.ANOMALY
    if tally.has_dispute:
        return ReconcileStatus.DISPUTED
    if invoice.amount_due > 0 and tally.net_paid >= invoice.amount_due:
        return ReconcileStatus.PAID
    if tally.net_paid > 0:
        return ReconcileStatus.PARTIAL
    return ReconcileStatus.UNPAID


def total_paid(invoice: Invoice, events: list[PaymentEvent]) -> Decimal:
    """Net payments observed for this invoice (payments - refunds), currency-guarded."""
    return tally_events(invoice, events).net_paid


def reconcile_payment(
    invoice: Invoice, events: list[PaymentEvent]
) -> tuple[ReconcileStatus, Decimal]:
    """Classify the invoice from its events. Returns (status, net_recovered)."""
    tally = tally_events(invoice, events)
    return classify(invoice, tally), tally.net_paid


def classify_plan(
    invoice: Invoice, plan: PaymentPlan, events: list[PaymentEvent]
) -> ReconcileStatus:
    """Schedule-aware variant of :func:`classify` for an active PaymentPlan
    (SCHEMA.md §8) - a separate function, not a parameter on ``classify``, since
    comparing against a cumulative schedule is a different algorithm from
    comparing against one scalar ``amount_due``. ``classify`` itself is untouched
    for every non-plan invoice.

    Reuses ``tally_events`` (still the single source of truth for money observed
    against this invoice - each installment's own Stripe link still produces
    ordinary PaymentEvents) rather than trying to attribute individual events to
    specific installments.
    """
    tally = tally_events(invoice, events)
    if tally.currency_mismatch:
        return ReconcileStatus.ANOMALY
    if tally.has_dispute:
        return ReconcileStatus.DISPUTED
    if invoice.amount_due > 0 and tally.net_paid >= invoice.amount_due:
        return ReconcileStatus.PAID
    cumulative_due = sum(
        (i.amount for i in plan.installments if i.due_date <= invoice.as_of_date),
        Decimal("0"),
    )
    if tally.net_paid < cumulative_due:
        return ReconcileStatus.INSTALLMENT_OVERDUE
    if tally.net_paid > 0:
        return ReconcileStatus.PARTIAL
    return ReconcileStatus.UNPAID


def mark_paid_installments(plan: PaymentPlan, net_paid: Decimal, as_of: date) -> PaymentPlan:
    """FIFO-allocate ``net_paid`` across ``plan.installments`` in order, marking
    each covered installment's ``paid_at``. A deliberate simplification: this
    doesn't attribute a specific Stripe session to a specific installment link,
    it just asks "has enough arrived, in total, to have covered the first N
    installments" - correct as long as installments are paid in order, which the
    schedule itself assumes.
    """
    remaining = net_paid
    new_installments = []
    for i in plan.installments:
        if i.is_paid:
            new_installments.append(i)
            continue
        if remaining >= i.amount:
            remaining -= i.amount
            new_installments.append(replace(i, paid_at=as_of))
        else:
            new_installments.append(i)
    return replace(plan, installments=tuple(new_installments))
