"""The orchestrator spine: route one invoice end-to-end.

Pure coordination over *injected* agents — no SDK, no model calls here. The
orchestrator decides nothing about safety itself; it sequences the agents that do:

    ingestion (validate/quarantine)
        → strategy            SKIP / HOLD / REVIEW / CHASE
        → (CHASE only) draft  → compliance gate  → send

Two CLAUDE.md invariants are enforced structurally in this file:

  * The compliance gate is the only thing that clears a send. The CHASE path
    *always* runs the gate before the sender is ever called, and the orchestrator
    never second-guesses or overrides a gate result.
  * Pilot-mode human-in-the-loop: the gate raises ``FIRST_CONTACT_APPROVAL`` on the
    first message to a new debtor. The orchestrator does not own that rule — it only
    *classifies* the block: if approval is the sole reason the draft is otherwise
    clean and just needs one-tap sign-off (``AWAITING_APPROVAL``); any other rule
    means a real escalation (``ESCALATED``).

Every hop is written to the execution log by the agent that owns it; the
orchestrator adds the ingestion + approval entries that have no agent of their own.
"""

from __future__ import annotations

from typing import Callable

from settl.agents.strategy import Action, StrategyAgent, StrategyDecision
from settl.audit.execution_log import ExecutionLog
from settl.compliance import ComplianceGate
from settl.compliance.gate import ComplianceResult, GateDecision
from settl.orchestrator.result import PipelineResult, PipelineStep, TerminalState
from settl.schema.invoice import Channel, Invoice
from settl.schema.validation import validate_invoice
from settl.sending.base import Sender
from settl.sending.mock_sender import MockSender

# The gate code that means "clean draft, just needs one-tap human sign-off" rather
# than a genuine safety problem. Owned by compliance/rules.py — referenced, not redefined.
_APPROVAL_CODE = "FIRST_CONTACT_APPROVAL"

# A drafter turns (invoice, strategy decision) into a candidate message. The real
# Gemini drafting agent (Week 2) implements this same shape; until then a benign
# template stands in. The gate judges whatever this produces — never the drafter.
Drafter = Callable[[Invoice, StrategyDecision], str]

_DEFAULT_TEMPLATE = (
    "Hi {name} — a friendly reminder that invoice {ref} for {amount} {currency} "
    "is past due ({days}d). Here is your secure payment link to settle it whenever "
    "convenient. Thank you!"
)


def default_draft(invoice: Invoice, decision: StrategyDecision) -> str:
    """Safe deterministic stand-in for the drafting agent."""
    return _DEFAULT_TEMPLATE.format(
        name=invoice.debtor_name,
        ref=invoice.invoice_id,
        amount=invoice.amount_due,
        currency=invoice.currency,
        days=invoice.days_overdue,
    )


class Orchestrator:
    """Drives invoices through the pipeline. Agents are injected so the whole spine
    is testable offline and any agent can be swapped for its real (SDK) version."""

    def __init__(
        self,
        *,
        log: ExecutionLog | None = None,
        strategy: StrategyAgent | None = None,
        gate: ComplianceGate | None = None,
        sender: Sender | None = None,
        draft_fn: Drafter = default_draft,
    ) -> None:
        self._log = log
        self._strategy = strategy or StrategyAgent(log=log)
        self._gate = gate or ComplianceGate(log=log)
        self._sender = sender or MockSender(log=log)
        self._draft_fn = draft_fn

    # -- public API -----------------------------------------------------------

    def run_batch(self, invoices: list[Invoice]) -> list[PipelineResult]:
        return [self.run_one(inv) for inv in invoices]

    def run_one(self, invoice: Invoice) -> PipelineResult:
        # 0. Ingestion: validate completeness; unreadable invoices never proceed.
        issues = validate_invoice(invoice)
        if issues:
            reason = "; ".join(f"{i.field}: {i.message}" for i in issues)
            self._record(invoice, "ingestion", "quarantined", reason)
            return PipelineResult(
                invoice.invoice_id,
                TerminalState.QUARANTINED,
                steps=[PipelineStep("ingestion", "quarantined", reason)],
                detail=f"couldn't read invoice: {reason}",
            )
        self._record(invoice, "ingestion", "accepted", "Invoice complete — actionable.")
        steps = [PipelineStep("ingestion", "accepted", "complete")]

        # 1. Strategy (logs itself).
        decision = self._strategy.decide(invoice)
        steps.append(PipelineStep("strategy", decision.action.value, decision.reasoning))

        if decision.action is Action.SKIP:
            return self._finish(invoice, TerminalState.SKIPPED, steps, decision.reasoning)
        if decision.action is Action.HOLD:
            return self._finish(
                invoice, TerminalState.HELD, steps, decision.reasoning,
                requeue_in_days=decision.next_touch_in_days,
            )
        if decision.action is Action.REVIEW:
            # State-level gate check for the record, then route to a human.
            result = self._gate.evaluate(invoice)
            steps.append(PipelineStep("compliance_gate", result.decision.value, result.reasoning))
            return self._finish(
                invoice, TerminalState.ESCALATED, steps,
                decision.escalation_hint or "routed to human",
            )

        # 2. CHASE → draft → gate → (send | approval).
        return self._run_chase(invoice, decision, steps)

    def approve_and_send(
        self, invoice: Invoice, message: str, channel: Channel | None = None
    ) -> PipelineResult:
        """Human one-tap approval of a draft that was held for first-contact sign-off.

        Re-runs the gate. The human may override ONLY ``FIRST_CONTACT_APPROVAL`` —
        if any other rule fires (the draft changed, the debtor disputed since, …)
        the approval is refused and the message escalates. This is the single path
        a first-contact message can legitimately reach the sender; the dashboard's
        approve button calls exactly this."""
        result = self._gate.evaluate(invoice, message)
        steps = [PipelineStep("compliance_gate", result.decision.value, result.reasoning)]
        other = set(result.codes) - {_APPROVAL_CODE}
        if other:
            outcome = self._sender.send(invoice, message, result, channel)
            steps.append(PipelineStep("sender", "withheld", outcome.detail))
            return PipelineResult(
                invoice.invoice_id, TerminalState.ESCALATED, steps=steps,
                message=message, channel=channel.value if channel else None,
                detail=f"approval refused — unresolved: {','.join(sorted(other))}",
            )

        # Only the first-contact hold remained → the human cleared it.
        approved = ComplianceResult(
            GateDecision.PASS, [], "Human approved first contact — cleared to send."
        )
        self._record(invoice, "human_approval", "approved", approved.reasoning)
        steps.append(PipelineStep("human_approval", "approved", approved.reasoning))
        outcome = self._sender.send(invoice, message, approved, channel)
        steps.append(PipelineStep("sender", "sent", outcome.detail))
        return PipelineResult(
            invoice.invoice_id, TerminalState.SENT, steps=steps,
            message=message, channel=channel.value if channel else None,
            detail=outcome.detail if outcome.sent else "send failed",
        )

    # -- chase path -----------------------------------------------------------

    def _run_chase(
        self, invoice: Invoice, decision: StrategyDecision, steps: list[PipelineStep]
    ) -> PipelineResult:
        message = self._draft_fn(invoice, decision)
        channel = decision.channel.value if decision.channel else None

        # The gate is the only authority that clears a send.
        result = self._gate.evaluate(invoice, message)
        steps.append(PipelineStep("compliance_gate", result.decision.value, result.reasoning))

        if not result.passed:
            # The gate blocked. Classify why: a draft whose ONLY issue is the
            # first-contact rule is clean and just needs one-tap human sign-off;
            # anything else is a genuine escalation. The gate stays the authority —
            # either way the sender is never called on a non-passing result.
            if set(result.codes) == {_APPROVAL_CODE}:
                reason = "Clean draft — holding for one-tap first-contact approval (pilot mode)."
                self._record(invoice, "human_approval", "awaiting_approval", reason)
                steps.append(PipelineStep("human_approval", "awaiting_approval", reason))
                return self._finish(
                    invoice, TerminalState.AWAITING_APPROVAL, steps, reason,
                    message=message, channel=channel,
                )
            # Defensive backstop: the sender refuses and logs the withhold too.
            outcome = self._sender.send(invoice, message, result, decision.channel)
            steps.append(PipelineStep("sender", "withheld", outcome.detail))
            return self._finish(
                invoice, TerminalState.ESCALATED, steps,
                ",".join(result.codes), message=message, channel=channel,
            )

        outcome = self._sender.send(invoice, message, result, decision.channel)
        steps.append(PipelineStep("sender", "sent", outcome.detail))
        return self._finish(
            invoice, TerminalState.SENT, steps,
            "clean -> sent" if outcome.sent else outcome.detail,
            message=message, channel=channel,
        )

    # -- helpers --------------------------------------------------------------

    def _finish(
        self,
        invoice: Invoice,
        state: TerminalState,
        steps: list[PipelineStep],
        detail: str,
        *,
        message: str | None = None,
        channel: str | None = None,
        requeue_in_days: int | None = None,
    ) -> PipelineResult:
        return PipelineResult(
            invoice.invoice_id, state, steps=steps, message=message,
            channel=channel, requeue_in_days=requeue_in_days, detail=detail,
        )

    def _record(self, invoice: Invoice, agent: str, decision: str, reasoning: str) -> None:
        if self._log is not None:
            self._log.record(
                invoice_id=invoice.invoice_id, agent=agent,
                decision=decision, reasoning=reasoning,
            )
