"""The reconcile agent: detect payment, record the fee, decide stop/requeue, notify.

Phase 1 closes the loop on a full payment: PAID → stop the loop, record the success fee
(never collected), log it, and fire an operator notification. PARTIAL/UNPAID are returned
with their loop decisions so the orchestrator loop can extend in later phases. The agent
re-derives status from events via ``reconcile_payment`` - it never trusts ``invoice.status``.
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
from settl.agents.reconcile.payment import reconcile_payment
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

    def reconcile(self, invoice: Invoice, events: list[PaymentEvent]) -> ReconcileOutcome:
        status, recovered = reconcile_payment(invoice, events)

        if status is ReconcileStatus.PAID:
            fee = record_fee(invoice, recovered, self._fee_pct)
            reasoning = (
                f"Paid in full - {recovered} {invoice.currency} recovered; loop stops. "
                f"Success fee {fee.fee_amount} {fee.currency} recorded (not collected)."
            )
            self._record(invoice, "paid", reasoning, fee_amount=str(fee.fee_amount))
            if self._notifier is not None:
                self._notifier.notify_paid(invoice, fee)
            return ReconcileOutcome(
                status=status, stop_loop=True, amount_recovered=recovered,
                fee=fee, reasoning=reasoning,
            )

        if status is ReconcileStatus.PARTIAL:
            reasoning = (
                f"Partial payment {recovered}/{invoice.amount_due} {invoice.currency} - "
                "balance remains; handled in a later phase."
            )
            self._record(invoice, "partial", reasoning)
            return ReconcileOutcome(
                status=status, stop_loop=False, amount_recovered=recovered, reasoning=reasoning,
            )

        reasoning = "No payment detected - re-queue for the next touch."
        self._record(invoice, "unpaid", reasoning)
        return ReconcileOutcome(
            status=status, stop_loop=False, amount_recovered=Decimal(0), reasoning=reasoning,
        )

    def _record(self, invoice: Invoice, decision: str, reasoning: str, **details) -> None:
        if self._log is not None:
            self._log.record(
                invoice_id=invoice.invoice_id, agent="reconcile",
                decision=decision, reasoning=reasoning, **details,
            )
