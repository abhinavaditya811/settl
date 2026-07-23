"""The orchestrator spine: route one invoice end-to-end.

Pure coordination over *injected* agents - no SDK, no model calls here. The
orchestrator decides nothing about safety itself; it sequences the agents that do:

    ingestion (validate/quarantine)
        → strategy            SKIP / HOLD / REVIEW / CHASE
        → (CHASE only) draft  → compliance gate  → send

Two CLAUDE.md invariants are enforced structurally in this file:

  * The compliance gate is the only thing that clears a send. The CHASE path
    *always* runs the gate before the sender is ever called, and the orchestrator
    never second-guesses or overrides a gate result.
  * Pilot-mode human-in-the-loop: the gate raises ``FIRST_CONTACT_APPROVAL`` on the
    first message to a new debtor. The orchestrator does not own that rule - it only
    *classifies* the block: if approval is the sole reason the draft is otherwise
    clean and just needs one-tap sign-off (``AWAITING_APPROVAL``); any other rule
    means a real escalation (``ESCALATED``).

Every hop is written to the execution log by the agent that owns it; the
orchestrator adds the ingestion + approval entries that have no agent of their own.
"""

from __future__ import annotations

from typing import Callable

from settl.agents.drafting import DraftedMessage, DraftingAgent, ReplyDraftingAgent, build_prompt
from settl.agents.drafting.grounding import StaticVoiceGrounding
from settl.agents.inbound import ALERT_ONLY_LANES, InboundAgent, InboundLane
from settl.agents.strategy import Action, StrategyAgent, StrategyDecision
from settl.audit.execution_log import ExecutionLog
from settl.compliance import ComplianceGate
from settl.compliance.gate import ComplianceResult, GateDecision
from settl.governance import RuleStore, guardrail_violations
from settl.orchestrator.result import PipelineResult, PipelineStep, TerminalState
from settl.schema.invoice import Channel, Invoice
from settl.schema.validation import validate_invoice
from settl.sending.base import Sender
from settl.sending.mock_sender import MockSender
from settl.tenancy.config import TenantConfig

# The gate code that means "clean draft, just needs one-tap human sign-off" rather
# than a genuine safety problem. Owned by compliance/rules.py - referenced, not redefined.
_APPROVAL_CODE = "FIRST_CONTACT_APPROVAL"

# A drafter turns (invoice, strategy decision) into a candidate message. The real
# Gemini drafting agent implements this as ``DraftingAgent.draft`` (returns a
# ``DraftedMessage``); a plain ``str``-returning callable can still stand in for it
# (tests, custom drafters). The gate judges whatever this produces - never the drafter.
Drafter = Callable[[Invoice, StrategyDecision], "DraftedMessage | str"]


def default_draft(invoice: Invoice, decision: StrategyDecision) -> str:
    """Safe deterministic stand-in: the drafting prompt's compliant fallback.

    Shares its wording with ``NoOpDraftModel`` (one source of truth) so the offline
    default and any explicit fallback produce the same gate-clearing message.
    """
    return build_prompt(invoice, decision).safe_fallback()


class Orchestrator:
    """Drives invoices through the pipeline. Agents are injected so the whole spine
    is testable offline and any agent can be swapped for its real (SDK) version."""

    def __init__(
        self,
        *,
        log: ExecutionLog | None = None,
        config: TenantConfig | None = None,
        strategy: StrategyAgent | None = None,
        gate: ComplianceGate | None = None,
        sender: Sender | None = None,
        drafter: DraftingAgent | None = None,
        draft_fn: Drafter | None = None,
        rules_store: RuleStore | None = None,
        inbound_agent: InboundAgent | None = None,
        reply_drafter: ReplyDraftingAgent | None = None,
    ) -> None:
        self._log = log
        self._config = config
        # Operator guardrails (human-in-the-loop). Threaded into the default strategy +
        # gate below, the same way TenantConfig is. Can only tighten / soft-waive.
        self._rules_store = rules_store
        self._strategy = strategy or self._default_strategy(log, config, rules_store)
        # When a tenant config is supplied, each default agent is built from its
        # slice: policy → gate bounds, payments → sender default link, voice →
        # drafting grounding. An explicitly injected agent always wins. Config can
        # only tighten the gate; it never bypasses it (SCHEMA.md §3).
        self._gate = gate or self._default_gate(log, config, rules_store)
        self._sender = sender or self._default_sender(log, config)
        # The drafting agent (the visible AI) is the default producer. A bare
        # ``draft_fn`` can still be injected to stand in for it.
        self._drafter = drafter or self._default_drafter(log, config)
        self._draft_fn = draft_fn or self._drafter.draft
        # Inbound reply handling (SCHEMA.md §7) - separate from the chase drafter
        # above since replying responds to the debtor's own words, not a strategy
        # decision. Voice grounding is shared with the chase drafter's config.
        self._inbound_agent = inbound_agent or InboundAgent(log=log)
        self._reply_drafter = reply_drafter or self._default_reply_drafter(log, config)

    @staticmethod
    def _default_strategy(
        log: ExecutionLog | None,
        config: TenantConfig | None,
        rules_store: RuleStore | None = None,
    ) -> StrategyAgent:
        if config is None:
            return StrategyAgent(log=log, rules_store=rules_store)
        return StrategyAgent(
            log=log,
            min_days_between_touches=config.policy.min_days_between_touches,
            allowed_tones=config.policy.allowed_tones,
            # Voice eligibility comes from the audio slice: opt-in, escalation-only.
            voice_enabled=config.audio.enabled,
            voice_min_days_overdue=config.audio.min_days_overdue,
            voice_min_prior_touches=config.audio.min_prior_touches,
            rules_store=rules_store,
        )

    @staticmethod
    def _default_gate(
        log: ExecutionLog | None,
        config: TenantConfig | None,
        rules_store: RuleStore | None = None,
    ) -> ComplianceGate:
        if config is None:
            return ComplianceGate(log=log, rules_store=rules_store)
        return ComplianceGate(
            log=log,
            frequency_window=config.policy.frequency_window_days,
            frequency_max=config.policy.max_touches,
            payment_plan_autonomy=config.policy.payment_plan_autonomy,
            payment_plan_min_amount=config.policy.payment_plan_min_amount,
            rules_store=rules_store,
        )

    @staticmethod
    def _default_sender(
        log: ExecutionLog | None, config: TenantConfig | None
    ) -> Sender:
        default_link = config.payments.default_payment_link if config else None
        return MockSender(log=log, default_payment_link=default_link)

    @staticmethod
    def _default_drafter(
        log: ExecutionLog | None, config: TenantConfig | None
    ) -> DraftingAgent:
        if config is None or not config.voice.voice_block.strip():
            return DraftingAgent(log=log)
        return DraftingAgent(
            log=log, grounding=StaticVoiceGrounding(config.voice.voice_block)
        )

    @staticmethod
    def _default_reply_drafter(
        log: ExecutionLog | None, config: TenantConfig | None
    ) -> ReplyDraftingAgent:
        if config is None or not config.voice.voice_block.strip():
            return ReplyDraftingAgent(log=log)
        return ReplyDraftingAgent(
            log=log, grounding=StaticVoiceGrounding(config.voice.voice_block)
        )

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
        self._record(invoice, "ingestion", "accepted", "Invoice complete - actionable.")
        steps = [PipelineStep("ingestion", "accepted", "complete")]

        # 1. Strategy (logs itself).
        decision = self._strategy.decide(invoice)
        steps.append(PipelineStep("strategy", decision.action.value, decision.reasoning))

        if decision.action in (Action.SKIP, Action.HOLD):
            # ALWAYS_ESCALATE means "a human looks at this no matter what" - unlike
            # REVIEW/CHASE, these two branches return before ever reaching the gate
            # where guardrail_violations is normally checked.
            forced = guardrail_violations(invoice, self._rules_store)
            if forced:
                reason = "; ".join(v.message for v in forced)
                steps.append(PipelineStep("compliance_gate", "escalate", reason))
                return self._finish(invoice, TerminalState.ESCALATED, steps, reason)

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

        Re-runs the gate. The human may override ONLY ``FIRST_CONTACT_APPROVAL`` -
        if any other rule fires (the draft changed, the debtor disputed since, …)
        the approval is refused and the message escalates. This is the single path
        a first-contact message can legitimately reach the sender; the dashboard's
        approve button calls exactly this."""
        # Gate is channel-aware: a voice approval runs the voice rules too. Until a
        # per-debtor consent source is wired (Phase 3), a VOICE send has no
        # VoiceContext here, so the gate fails safe (VOICE_NO_CONSENT → escalate)
        # rather than clear a call whose consent/disclosure was never checked.
        result = self._gate.evaluate(invoice, message, channel=channel)
        steps = [PipelineStep("compliance_gate", result.decision.value, result.reasoning)]
        other = set(result.codes) - {_APPROVAL_CODE}
        if other:
            outcome = self._sender.send(invoice, message, result, channel)
            steps.append(PipelineStep("sender", "withheld", outcome.detail))
            return PipelineResult(
                invoice.invoice_id, TerminalState.ESCALATED, steps=steps,
                message=message, channel=channel.value if channel else None,
                detail=f"approval refused - unresolved: {','.join(sorted(other))}",
            )

        # Only the first-contact hold remained → the human cleared it.
        approved = ComplianceResult(
            GateDecision.PASS, [], "Human approved first contact - cleared to send."
        )
        self._record(invoice, "human_approval", "approved", approved.reasoning)
        steps.append(PipelineStep("human_approval", "approved", approved.reasoning))
        outcome = self._sender.send(invoice, message, approved, channel)
        if not outcome.sent:
            # Approved + gate-clear, but the sender withheld (e.g. unresolved link).
            steps.append(PipelineStep("sender", "withheld", outcome.detail))
            return PipelineResult(
                invoice.invoice_id, TerminalState.ESCALATED, steps=steps,
                message=message, channel=channel.value if channel else None,
                detail=outcome.detail,
            )
        steps.append(PipelineStep("sender", "sent", outcome.detail))
        return PipelineResult(
            invoice.invoice_id, TerminalState.SENT, steps=steps,
            message=message, channel=channel.value if channel else None,
            detail=outcome.detail,
        )

    # -- chase path -----------------------------------------------------------

    def _run_chase(
        self, invoice: Invoice, decision: StrategyDecision, steps: list[PipelineStep]
    ) -> PipelineResult:
        drafted = self._draft_fn(invoice, decision)
        message = drafted.text if isinstance(drafted, DraftedMessage) else str(drafted)
        source = drafted.source if isinstance(drafted, DraftedMessage) else "template"
        steps.append(PipelineStep("drafting", source, "candidate drafted for the gate"))
        # The gate is the only authority that clears a send - and it's channel-aware,
        # so a voice CHASE runs the voice rules (fail-safe: no VoiceContext yet →
        # escalate). Email/SMS are unaffected (voice rules are guarded by channel).
        return self._gate_and_send(invoice, message, decision.channel, steps)

    # -- inbound path (SCHEMA.md §7) -------------------------------------------

    def handle_inbound(self, invoice: Invoice, message_text: str) -> PipelineResult:
        """One inbound debtor reply → classify → lane-route.

        Alert-only lanes (dispute, low-confidence, and payment-plan-request until
        the PaymentPlan flow lands) never draft or send - just escalate. A BENIGN
        reply drafts and gates exactly like a chase message; FIRST_CONTACT_APPROVAL
        behaves identically either way (rule_first_contact reads the same
        ``is_new_debtor`` signal), so no separate approval logic is needed here -
        the gate already enforces "first touch needs approval, later touches don't"
        for a reply the same as for an AI-initiated chase.

        Pure coordination, same as the rest of this file - no Supabase writes here.
        The caller (the inbound edge, SCHEMA.md §7) is responsible for persisting
        both the inbound message and any outbound reply as ``contacts`` rows
        (data/supabase/contacts_store.py::write_contact) before/after calling this,
        including ``classification=classification.lane.value`` on the inbound row so
        later calls see this thread's history.
        """
        classification = self._inbound_agent.classify(invoice, message_text)
        steps = [
            PipelineStep(
                "inbound_classifier", classification.lane.value, classification.reasoning
            )
        ]

        if classification.lane in ALERT_ONLY_LANES or (
            classification.lane is InboundLane.PAYMENT_PLAN_REQUEST
        ):
            reason = classification.reasoning
            if classification.lane is InboundLane.PAYMENT_PLAN_REQUEST:
                reason = (
                    "Payment-plan request - handled by the PaymentPlan flow "
                    "(not yet wired here), never an auto-drafted reply."
                )
            self._record(invoice, "inbound", "escalated", reason)
            steps.append(PipelineStep("inbound", "escalated", reason))
            return self._finish(invoice, TerminalState.ESCALATED, steps, reason)

        drafted = self._reply_drafter.draft(invoice, message_text)
        steps.append(PipelineStep("drafting", drafted.source, "reply drafted for the gate"))
        return self._gate_and_send(invoice, drafted.text, Channel.EMAIL, steps)

    # -- shared gate → send tail ------------------------------------------------

    def _gate_and_send(
        self,
        invoice: Invoice,
        message: str,
        channel: Channel | None,
        steps: list[PipelineStep],
    ) -> PipelineResult:
        channel_value = channel.value if channel else None
        result = self._gate.evaluate(invoice, message, channel=channel)
        steps.append(PipelineStep("compliance_gate", result.decision.value, result.reasoning))

        if not result.passed:
            # The gate blocked. Classify why: a draft whose ONLY issue is the
            # first-contact rule is clean and just needs one-tap human sign-off;
            # anything else is a genuine escalation. The gate stays the authority -
            # either way the sender is never called on a non-passing result.
            if set(result.codes) == {_APPROVAL_CODE}:
                reason = "Clean draft - holding for one-tap first-contact approval (pilot mode)."
                self._record(invoice, "human_approval", "awaiting_approval", reason)
                steps.append(PipelineStep("human_approval", "awaiting_approval", reason))
                return self._finish(
                    invoice, TerminalState.AWAITING_APPROVAL, steps, reason,
                    message=message, channel=channel_value,
                )
            # Defensive backstop: the sender refuses and logs the withhold too.
            outcome = self._sender.send(invoice, message, result, channel)
            steps.append(PipelineStep("sender", "withheld", outcome.detail))
            return self._finish(
                invoice, TerminalState.ESCALATED, steps,
                ",".join(result.codes), message=message, channel=channel_value,
            )

        outcome = self._sender.send(invoice, message, result, channel)
        if not outcome.sent:
            # Gate passed, but the sender withheld (e.g. no resolvable payment link).
            # Never report SENT for a message that didn't go out - route to a human.
            steps.append(PipelineStep("sender", "withheld", outcome.detail))
            return self._finish(
                invoice, TerminalState.ESCALATED, steps, outcome.detail,
                message=message, channel=channel_value,
            )
        steps.append(PipelineStep("sender", "sent", outcome.detail))
        return self._finish(
            invoice, TerminalState.SENT, steps, "clean -> sent",
            message=message, channel=channel_value,
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
