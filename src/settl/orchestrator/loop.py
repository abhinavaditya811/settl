"""The unpaid loop: given a pipeline outcome, decide whether the invoice comes
back around and when.

This is the Week-1 skeleton. The real next-touch scheduling and "stop on paid,
escalate on reply" logic lands in Week 4 once the reconcile agent exists and can
re-verify payment status. For now we encode the structural rule only:

  * HELD → re-queue after the strategy's cooldown window.
  * SENT → re-queue for a follow-up (a fixed cadence stand-in until reconcile
    decides based on real payment/reply events).
  * everything else is terminal — it does not loop.
"""

from __future__ import annotations

from dataclasses import dataclass

from settl.orchestrator.result import PipelineResult, TerminalState

# Stand-in follow-up cadence after a send, until reconcile drives this from events.
DEFAULT_FOLLOWUP_DAYS = 7


@dataclass(frozen=True)
class LoopDecision:
    requeue: bool
    in_days: int | None = None
    reason: str = ""


def next_touch(result: PipelineResult) -> LoopDecision:
    """Decide whether (and when) an invoice re-enters the orchestrator."""
    if result.terminal_state is TerminalState.HELD:
        days = result.requeue_in_days or DEFAULT_FOLLOWUP_DAYS
        return LoopDecision(True, days, f"on hold — revisit in {days}d")

    if result.terminal_state is TerminalState.SENT:
        return LoopDecision(
            True, DEFAULT_FOLLOWUP_DAYS,
            f"sent — follow up in {DEFAULT_FOLLOWUP_DAYS}d if still unpaid "
            "(reconcile will confirm in Week 4)",
        )

    return LoopDecision(False, None, f"terminal ({result.terminal_state.value}) — no re-queue")
