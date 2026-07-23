"""The reconcile agent: detect payment, record the fee, decide stop/requeue, notify.

Re-derives status from the full event log via ``reconcile_payment`` - it never trusts
``invoice.status``. Each status has one loop decision:

  * PAID     → record the (capped) success fee, stop the loop, notify the operator.
  * PARTIAL  → record a proportional fee on what's recovered so far, carry the residual
               balance, keep the loop open so the next touch chases the remainder.
  * DISPUTED → a chargeback: escalate to a human, stop the loop (never auto-act).
  * REPLY    → an inbound debtor reply/dispute: escalate, stop the loop.
  * ANOMALY  → unusable data (currency mismatch): escalate, stop; don't guess.
  * UNPAID   → nothing detected: re-queue for the next touch.

Refunds need no special case: they lower net paid, so a previously-PAID invoice simply
reconciles to PARTIAL/UNPAID with a smaller (or no) fee on the next run.
"""

from __future__ import annotations

from decimal import Decimal

from settl.agents.reconcile.events import (
    PaymentEvent,
    ReconcileOutcome,
    ReconcileStatus,
)
from settl.agents.reconcile.fee import record_fee
from settl.agents.reconcile.notify import OperatorNotifier
from settl.agents.reconcile.payment import classify, tally_events
from settl.audit.execution_log import ExecutionLog
from settl.schema.invoice import Invoice
from settl.tenancy.config import DEFAULT_POLICY


class ReconcileAgent:
    def __init__(
        self,
        log: ExecutionLog | None = None,
        *,
        success_fee_pct: float | None = None,
        notifier: OperatorNotifier | None = None,
    ) -> None:
        self._log = log
        # Per-tenant success fee (TenantConfig.policy); default until per-tenant wiring.
        self._fee_pct = success_fee_pct if success_fee_pct is not None else DEFAULT_POLICY.success_fee_pct
        self._notifier = notifier

    def reconcile(
        self, invoice: Invoice, events: list[PaymentEvent], *, notify: bool = True
    ) -> ReconcileOutcome:
        """Re-derive status over the event log; log + (optionally) notify the operator.

        ``notify=False`` restores state WITHOUT emailing - used when replaying
        already-processed persisted events at startup (ReconciliationDesk.load_events).
        The "Recovered/Needs review" email already fired when the payment was first
        discovered live; re-firing it on every restart is pure spam (an observed bug -
        the operator got the same "Recovered" email once per server restart)."""
        tally = tally_events(invoice, events)
        status = classify(invoice, tally)

        if status is ReconcileStatus.PAID:
            fee = record_fee(invoice, tally.net_paid, self._fee_pct)
            reasoning = (
                f"Paid in full - {tally.net_paid} {invoice.currency} recovered; loop stops. "
                f"Success fee {fee.fee_amount} {fee.currency} recorded (not collected)."
            )
            self._record(invoice, "paid", reasoning, fee_amount=str(fee.fee_amount))
            if self._notifier is not None and notify:
                self._notifier.notify_paid(invoice, fee)
            return ReconcileOutcome(
                status=status, stop_loop=True, amount_recovered=tally.net_paid,
                fee=fee, reasoning=reasoning,
            )

        if status is ReconcileStatus.PARTIAL:
            fee = record_fee(invoice, tally.net_paid, self._fee_pct)
            reasoning = (
                f"Partial payment {tally.net_paid}/{invoice.amount_due} {invoice.currency} - "
                f"{tally.remaining} {invoice.currency} remaining; chase the residual next touch. "
                f"Success fee {fee.fee_amount} {fee.currency} recorded on recovered-to-date."
            )
            self._record(invoice, "partial", reasoning, fee_amount=str(fee.fee_amount))
            return ReconcileOutcome(
                status=status, stop_loop=False, amount_recovered=tally.net_paid,
                fee=fee, remaining_balance=tally.remaining, reasoning=reasoning,
            )

        if status in (ReconcileStatus.DISPUTED, ReconcileStatus.REPLY, ReconcileStatus.ANOMALY):
            reasons = {
                ReconcileStatus.DISPUTED: "Chargeback/dispute on this payment - escalate to a human; stop the loop.",
                ReconcileStatus.REPLY: "Inbound debtor reply/dispute - escalate to a human; stop the loop.",
                ReconcileStatus.ANOMALY: (
                    "Payment currency does not match the invoice - unusable data; "
                    "escalate to a human, do not act."
                ),
            }
            reasoning = reasons[status]
            self._record(invoice, status.value, reasoning)
            if self._notifier is not None and notify:
                self._notifier.notify_escalation(invoice, reasoning)
            return ReconcileOutcome(
                status=status, stop_loop=True, amount_recovered=tally.net_paid,
                remaining_balance=tally.remaining, escalate=True, reasoning=reasoning,
            )

        reasoning = "No payment detected - re-queue for the next touch."
        self._record(invoice, "unpaid", reasoning)
        return ReconcileOutcome(
            status=status, stop_loop=False, amount_recovered=Decimal(0),
            remaining_balance=invoice.amount_due, reasoning=reasoning,
        )

    def _record(self, invoice: Invoice, decision: str, reasoning: str, **details) -> None:
        if self._log is not None:
            self._log.record(
                invoice_id=invoice.invoice_id, agent="reconcile",
                decision=decision, reasoning=reasoning, **details,
            )
