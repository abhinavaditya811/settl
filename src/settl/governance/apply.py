"""Apply operator guardrails at the engine's decision seams.

Three pure helpers the strategy agent and the compliance gate call:

  * ``tighten_strategy`` - fold matching strategy directives into a StrategyDecision.
    It can ONLY reduce "send-iness" (CHASE→HOLD/SKIP, or a gentler tone); it can never
    move toward a send. So even a mis-entered guardrail can't make the engine act.
  * ``guardrail_violations`` - matching ALWAYS_ESCALATE directives become a synthetic
    ``OPERATOR_GUARDRAIL`` gate violation (a tightening override).
  * ``waived_codes`` - soft rule codes an operator waived, intersected with
    ``WAIVABLE_CODES`` so a legal/consumer/dispute code can never be cleared.

Nothing here decides a send - the gate remains the sole authority; these only steer its
inputs, the same way ``TenantConfig`` does.

Cross-package imports (strategy policy, compliance rules) are done lazily inside the
functions: this module is imported by both the strategy agent and the compliance gate, so
keeping load-time imports to leaf modules avoids an import cycle.
"""

from __future__ import annotations

import dataclasses
from typing import TYPE_CHECKING

from settl.governance.rules import Directive, Scope
from settl.schema.invoice import Invoice

if TYPE_CHECKING:
    from settl.agents.strategy.policy import StrategyDecision
    from settl.compliance.rules import RuleViolation
    from settl.governance.store import RuleStore


def tighten_strategy(
    invoice: Invoice, decision: StrategyDecision, rules: RuleStore | None
) -> StrategyDecision:
    """Overlay matching strategy guardrails onto a decision - downgrade-only."""
    if rules is None:
        return decision
    matching = [r for r in rules.matching(invoice) if r.scope is Scope.STRATEGY]
    if not matching:
        return decision

    from settl.agents.strategy.policy import Action, Tone

    send_rank = {Action.CHASE: 3, Action.HOLD: 2, Action.REVIEW: 1, Action.SKIP: 0}
    softer = {Tone.FINAL: Tone.FIRM, Tone.FIRM: Tone.FRIENDLY, Tone.FRIENDLY: Tone.FRIENDLY}

    action, tone = decision.action, decision.tone
    applied: list[tuple[str, str]] = []
    for r in matching:
        if r.directive is Directive.FORCE_SKIP and send_rank[action] > send_rank[Action.SKIP]:
            action = Action.SKIP
            applied.append((r.rule_id, "force skip"))
        elif r.directive is Directive.FORCE_HOLD and action is Action.CHASE:
            action = Action.HOLD
            applied.append((r.rule_id, "force hold"))
        elif r.directive is Directive.SOFTEN_TONE and action is Action.CHASE and isinstance(tone, Tone):
            if softer[tone] is not tone:
                tone = softer[tone]
                applied.append((r.rule_id, f"soften tone -> {tone.value}"))

    if not applied:
        return decision
    reasoning = decision.reasoning + " | " + "; ".join(
        f"operator guardrail {rid}: {what}" for rid, what in applied
    )
    next_touch = decision.next_touch_in_days
    if action is Action.HOLD and next_touch is None:
        next_touch = 7  # give the requeue loop a cadence when a guardrail forces HOLD
    return dataclasses.replace(
        decision, action=action, tone=tone, reasoning=reasoning, next_touch_in_days=next_touch
    )


def guardrail_violations(invoice: Invoice, rules: RuleStore | None) -> list[RuleViolation]:
    """ALWAYS_ESCALATE guardrails → a synthetic gate violation (tighten)."""
    if rules is None:
        return []
    from settl.compliance.rules import OPERATOR_GUARDRAIL, RuleViolation

    out: list[RuleViolation] = []
    for r in rules.matching(invoice):
        if r.scope is Scope.COMPLIANCE and r.directive is Directive.ALWAYS_ESCALATE:
            out.append(
                RuleViolation(
                    OPERATOR_GUARDRAIL,
                    f"Operator guardrail {r.rule_id}: {r.reason or 'always escalate matching cases'}.",
                )
            )
    return out


def waived_codes(invoice: Invoice, rules: RuleStore | None) -> set[str]:
    """Soft rule codes an operator waived for this invoice. Intersected with
    ``WAIVABLE_CODES`` - a hard/legal code is dropped and can never be waived."""
    if rules is None:
        return set()
    from settl.compliance.rules import WAIVABLE_CODES

    waived = {
        r.waive_code
        for r in rules.matching(invoice)
        if r.directive is Directive.WAIVE and r.waive_code
    }
    return waived & WAIVABLE_CODES
