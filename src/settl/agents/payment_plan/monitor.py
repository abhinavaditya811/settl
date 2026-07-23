"""Active-plan monitoring (SCHEMA.md §8): the reminder-then-escalate state
machine for a missed installment.

Kept separate from reconcile's own escalation set (ReconcileStatus.
ESCALATING_STATUSES) - a missed installment gets one reminder and only escalates
if it's still unpaid by the next installment's due date (or, for the last
installment, after a fixed grace window since there's no "next" date to anchor
to). That's a different, gentler cadence than a dispute/chargeback/anomaly.
"""

from __future__ import annotations

from datetime import timedelta
from enum import Enum

from settl.agents.payment_plan.models import Installment, PaymentPlan
from settl.schema.invoice import Invoice

# Vendor-configurable in spirit (mirrors min_days_between_touches); a fixed
# default until a tenant-policy slice for it is needed.
DEFAULT_FINAL_INSTALLMENT_GRACE_DAYS = 7


class InstallmentMonitorAction(str, Enum):
    NONE = "none"  # on schedule, or not yet due
    SEND_REMINDER = "send_reminder"  # first miss on this installment
    ESCALATE = "escalate"  # still unpaid after the reminder + the grace window


def _first_overdue(plan: PaymentPlan, as_of) -> Installment | None:
    overdue = [i for i in plan.installments if not i.is_paid and i.due_date <= as_of]
    return min(overdue, key=lambda i: i.index) if overdue else None


def next_action(
    plan: PaymentPlan,
    invoice: Invoice,
    *,
    reminder_sent_for_index: int | None,
    grace_days: int = DEFAULT_FINAL_INSTALLMENT_GRACE_DAYS,
) -> InstallmentMonitorAction:
    """What to do this run, given the highest installment index a reminder has
    already been sent for (None if none yet - the caller tracks this, e.g. via
    the execution log or a field on their own persistence)."""
    overdue = _first_overdue(plan, invoice.as_of_date)
    if overdue is None:
        return InstallmentMonitorAction.NONE

    already_reminded = (
        reminder_sent_for_index is not None and reminder_sent_for_index >= overdue.index
    )
    if not already_reminded:
        return InstallmentMonitorAction.SEND_REMINDER

    is_last = overdue.index == plan.installments[-1].index
    if is_last:
        deadline = overdue.due_date + timedelta(days=grace_days)
    else:
        next_installment = next(
            (i for i in plan.installments if i.index == overdue.index + 1), None
        )
        # No next installment recorded is a data inconsistency, not a reason to
        # stay silent - fail toward escalate rather than never surfacing this.
        deadline = next_installment.due_date if next_installment else invoice.as_of_date

    return (
        InstallmentMonitorAction.ESCALATE
        if invoice.as_of_date >= deadline
        else InstallmentMonitorAction.NONE
    )
