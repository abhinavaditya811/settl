"""The unpaid loop: given a pipeline outcome (and, once we have one, a reconcile
outcome), decide whether the invoice comes back around and when.

Two entry points:

  * ``next_touch(result)`` - the structural, pre-payment rule used right after a send,
    before reconcile has run:
      - HELD → re-queue after the strategy's cooldown window.
      - SENT → re-queue for a follow-up (a fixed cadence stand-in).
      - everything else is terminal - it does not loop.

  * ``next_touch_after_reconcile(result, outcome)`` - the Week-4 closure that drives the
    loop off *verified* payment state:
      - PAID → stop (loop closed, fee recorded).
      - PARTIAL → re-queue sooner to chase the residual balance.
      - UNPAID → re-queue on the normal follow-up cadence.
      - DISPUTED / REPLY / ANOMALY → stop and escalate to a human (never auto-act).

Importing ``reconcile.events`` here is safe - reconcile has no dependency on the
orchestrator, so there is no import cycle.
"""

from __future__ import annotations

from dataclasses import dataclass

from settl.agents.reconcile.events import ReconcileOutcome, ReconcileStatus
from settl.orchestrator.result import PipelineResult, TerminalState

# Stand-in follow-up cadence after a send, until reconcile drives this from events.
DEFAULT_FOLLOWUP_DAYS = 7
# A partial payment means the debtor is engaged - chase the remainder sooner.
PARTIAL_FOLLOWUP_DAYS = 3


@dataclass(frozen=True)
class LoopDecision:
    requeue: bool
    in_days: int | None = None
    reason: str = ""
    escalate: bool = False  # True → route to a human now (dispute / reply / anomaly)


def next_touch(result: PipelineResult) -> LoopDecision:
    """Decide whether (and when) an invoice re-enters the orchestrator."""
    if result.terminal_state is TerminalState.HELD:
        days = result.requeue_in_days or DEFAULT_FOLLOWUP_DAYS
        return LoopDecision(True, days, f"on hold - revisit in {days}d")

    if result.terminal_state is TerminalState.SENT:
        return LoopDecision(
            True, DEFAULT_FOLLOWUP_DAYS,
            f"sent - follow up in {DEFAULT_FOLLOWUP_DAYS}d if still unpaid "
            "(reconcile will confirm)",
        )

    return LoopDecision(False, None, f"terminal ({result.terminal_state.value}) - no re-queue")


def next_touch_after_reconcile(
    result: PipelineResult, outcome: ReconcileOutcome
) -> LoopDecision:
    """Close the loop on verified payment state (Week 4). Reconcile is the authority
    here - it re-derived status from events, so this just maps that onto a loop action."""
    if outcome.escalate:
        return LoopDecision(
            False, None,
            f"{outcome.status.value} - escalated to a human; loop stops.",
            escalate=True,
        )

    if outcome.status is ReconcileStatus.PAID:
        return LoopDecision(False, None, "paid in full - loop closed.")

    if outcome.status is ReconcileStatus.PARTIAL:
        return LoopDecision(
            True, PARTIAL_FOLLOWUP_DAYS,
            f"partial - {outcome.remaining_balance} remaining; chase the residual "
            f"in {PARTIAL_FOLLOWUP_DAYS}d.",
        )

    # UNPAID (or anything non-terminal reconcile leaves open) → normal follow-up.
    return LoopDecision(
        True, DEFAULT_FOLLOWUP_DAYS,
        f"unpaid - follow up in {DEFAULT_FOLLOWUP_DAYS}d.",
    )
