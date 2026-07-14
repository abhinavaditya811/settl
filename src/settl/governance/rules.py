"""Operator guardrails - the durable feedback a human leaves on an agent decision.

When an operator flags a decision, they leave a rule: a **directive** (what the engine
should do instead) plus **criteria** (which invoices it applies to, so "similar future
cases" follow it too). The rule is applied by ``apply.py`` at two seams - the strategy
agent (tighten the action) and the compliance gate (add escalation / waive a soft rule) -
never in a route or component.

Safety is structural (see ``compliance.rules.WAIVABLE_CODES``): directives can only make
the engine *stricter* freely; a WAIVE can only clear a soft, operational rule, never a
legal one. So a guardrail can never turn a "don't send" into a "send" for a hard rule.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from settl.schema.invoice import Invoice


class Scope(str, Enum):
    STRATEGY = "strategy"  # steers the StrategyDecision (before draft/gate)
    COMPLIANCE = "compliance"  # steers the compliance gate


class Directive(str, Enum):
    ALWAYS_ESCALATE = "always_escalate"  # (compliance) force escalation on a match
    FORCE_SKIP = "force_skip"  # (strategy) don't chase - drop to SKIP
    FORCE_HOLD = "force_hold"  # (strategy) don't chase now - drop to HOLD
    SOFTEN_TONE = "soften_tone"  # (strategy) chase, but one tone gentler
    WAIVE = "waive"  # (compliance) clear a SOFT rule the operator accepts


# Directives that only ever reduce "send-iness" - always safe to apply.
_TIGHTENING = frozenset(
    {Directive.ALWAYS_ESCALATE, Directive.FORCE_SKIP, Directive.FORCE_HOLD, Directive.SOFTEN_TONE}
)


@dataclass(frozen=True)
class OperatorRule:
    """One stored guardrail. ``criteria`` maps invoice attributes → required values;
    an empty criteria set matches nothing (a guardrail is always scoped to something)."""

    scope: Scope
    directive: Directive
    criteria: dict
    rule_id: str = ""
    tenant_id: str = ""  # the invoice's tenant when flagged - never applies cross-tenant
    waive_code: str | None = None  # for Directive.WAIVE
    reason: str = ""
    created_at: str = ""
    _factors: dict = field(default_factory=dict)

    @property
    def is_tightening(self) -> bool:
        return self.directive in _TIGHTENING


def _attr(invoice: Invoice, key: str):
    """Project the invoice attribute a criterion names (or None if unknown)."""
    return {
        "invoice_id": invoice.invoice_id,
        "debtor_name": invoice.debtor_name,
        "is_b2b": invoice.is_b2b,
        "status": invoice.status.value,
        "source": invoice.source.value,
    }.get(key)


def matches(rule: OperatorRule, invoice: Invoice) -> bool:
    """True when every criterion holds for this invoice. Empty criteria → False (a
    guardrail must be scoped; it never silently applies to everything). A rule never
    matches an invoice outside the tenant it was flagged on - a shared BoardState must
    not let one tenant's guardrail steer another tenant's invoice (e.g. matching
    debtor_name)."""
    if not rule.criteria:
        return False
    if rule.tenant_id != invoice.tenant_id:
        return False
    for key, expected in rule.criteria.items():
        if key == "days_overdue_gte":
            if invoice.days_overdue < expected:
                return False
        elif _attr(invoice, key) != expected:
            return False
    return True
