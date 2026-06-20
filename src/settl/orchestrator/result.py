"""What happened to one invoice as it travelled the pipeline.

These are pure value objects - no logic, no SDK. ``PipelineResult`` is the single
return shape the orchestrator hands back per invoice, and it doubles as the row the
demo/dashboard renders and the proof the audit log corroborates.

``TerminalState`` is the orchestrator's vocabulary for "where did this invoice end
up", one step above the agents' own decisions:

  QUARANTINED        validation failed - couldn't read it; flag to a human
  SKIPPED            nothing to do (paid, or not yet due)
  HELD               actionable later (cooldown / frequency) - re-queue
  ESCALATED          routed to a human now (dispute / consumer, or the gate blocked)
  AWAITING_APPROVAL  clean draft cleared the gate, but it's first contact →
                     one-tap human approval before it can send (pilot-mode HITL)
  SENT               clean draft cleared the gate and went out (mocked for now)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class TerminalState(str, Enum):
    QUARANTINED = "quarantined"
    SKIPPED = "skipped"
    HELD = "held"
    ESCALATED = "escalated"
    AWAITING_APPROVAL = "awaiting_approval"
    SENT = "sent"


# States that the unpaid loop should revisit later vs. ones that are final.
REQUEUE_STATES = frozenset({TerminalState.HELD, TerminalState.SENT})
TERMINAL_STATES = frozenset(
    {TerminalState.QUARANTINED, TerminalState.SKIPPED, TerminalState.ESCALATED}
)


@dataclass(frozen=True)
class PipelineStep:
    """One hop in the pipeline (mirrors one execution-log entry)."""

    agent: str  # "ingestion" | "strategy" | "compliance_gate" | "sender"
    decision: str  # short machine-readable outcome
    reasoning: str  # human-readable why


@dataclass(frozen=True)
class PipelineResult:
    """The end-to-end outcome for a single invoice."""

    invoice_id: str
    terminal_state: TerminalState
    steps: list[PipelineStep] = field(default_factory=list)
    message: str | None = None  # the draft, when one was produced
    channel: str | None = None  # how it would go out
    requeue_in_days: int | None = None  # for HELD: when to revisit
    detail: str = ""  # one-line human summary for the trace table

    @property
    def needs_human(self) -> bool:
        return self.terminal_state in (
            TerminalState.QUARANTINED,
            TerminalState.ESCALATED,
            TerminalState.AWAITING_APPROVAL,
        )

    @property
    def should_requeue(self) -> bool:
        return self.terminal_state in REQUEUE_STATES
