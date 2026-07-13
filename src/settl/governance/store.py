"""In-memory store of operator guardrails, scoped per tenant.

Mirrors the ``TenantConfig`` pattern (config that steers the engine as an input, never a
second gate). In-memory now; a durable per-tenant table is the later FR-5 concern. The
store only holds and matches rules - it never decides anything itself.
"""

from __future__ import annotations

from dataclasses import replace

from settl.governance.rules import OperatorRule, matches
from settl.schema.invoice import Invoice


class RuleStore:
    def __init__(self) -> None:
        self._rules: list[OperatorRule] = []
        self._seq = 0

    def add(self, rule: OperatorRule) -> OperatorRule:
        """Store a guardrail, assigning a stable id if it has none. Returns the stored
        rule (with its id) so the caller can echo it back to the operator.

        A rule loaded with an id already set (FR-5: reloaded from durable storage on
        startup) bumps the sequence past any "gr-<n>" suffix it carries, so a later
        auto-assigned id never re-mints one that's already taken - a restart must not
        let a fresh guardrail collide with, and silently shadow, a persisted one."""
        if not rule.rule_id:
            self._seq += 1
            rule = replace(rule, rule_id=f"gr-{self._seq}")
        else:
            suffix = rule.rule_id.rsplit("-", 1)[-1]
            if suffix.isdigit():
                self._seq = max(self._seq, int(suffix))
        self._rules.append(rule)
        return rule

    def matching(self, invoice: Invoice) -> list[OperatorRule]:
        """Guardrails that apply to this invoice, in insertion order."""
        return [r for r in self._rules if matches(r, invoice)]

    def all(self) -> list[OperatorRule]:
        return list(self._rules)

    def clear(self) -> None:
        self._rules.clear()
        self._seq = 0
