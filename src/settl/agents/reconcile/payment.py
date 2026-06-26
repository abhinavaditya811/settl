"""Pure payment reconciliation: (invoice, events) → status + recovered amount.

Re-derives the truth from observed payments; never trusts ``invoice.status``. No side
effects, no SDK - unit-testable in isolation. Phase 1 resolves PAID vs PARTIAL vs UNPAID;
the agent decides what to do with each.
"""

from __future__ import annotations

from decimal import Decimal

from settl.agents.reconcile.events import PaymentEvent, ReconcileStatus
from settl.schema.invoice import Invoice


def total_paid(invoice: Invoice, events: list[PaymentEvent]) -> Decimal:
    """Sum of payments observed for this invoice."""
    return sum(
        (e.amount for e in events if e.invoice_id == invoice.invoice_id),
        Decimal(0),
    )


def reconcile_payment(
    invoice: Invoice, events: list[PaymentEvent]
) -> tuple[ReconcileStatus, Decimal]:
    """Classify the invoice from its payments. Returns (status, amount_recovered)."""
    paid = total_paid(invoice, events)
    if invoice.amount_due > 0 and paid >= invoice.amount_due:
        return ReconcileStatus.PAID, paid
    if paid > 0:
        return ReconcileStatus.PARTIAL, paid
    return ReconcileStatus.UNPAID, Decimal(0)
