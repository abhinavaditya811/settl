"""Durable operator guardrails (settl/governance/rules.py, SCHEMA.md operator_rules).

RuleStore itself stays pure in-memory (it only holds and matches rules - see its
docstring); persistence is bolted on beside it here, the same seam BoardState
already uses for every other durable side effect. tenant_id is attributed from
the invoice the flag was raised on, and round-trips through OperatorRule.tenant_id
so RuleStore.matching() can enforce a rule never steers another tenant's invoice.
"""

from __future__ import annotations

from settl.data.supabase.connection import connect, to_jsonb
from settl.governance import Directive, OperatorRule, Scope

_SELECT_SQL = """
    select rule_id, tenant_id, scope, directive, criteria, waive_code, reason, factors, created_at
    from operator_rules
    order by created_at
"""

_INSERT_SQL = """
    insert into operator_rules (rule_id, tenant_id, scope, directive, criteria, waive_code, reason, factors)
    values (%(rule_id)s, %(tenant_id)s, %(scope)s, %(directive)s, %(criteria)s, %(waive_code)s, %(reason)s, %(factors)s)
    on conflict (rule_id) do nothing
"""


def load_rules() -> list[OperatorRule]:
    """Every stored guardrail, across every tenant (matches the shared-board
    reality of load_invoices() - see its docstring)."""
    with connect() as conn:
        rows = conn.execute(_SELECT_SQL).fetchall()
    return [
        OperatorRule(
            scope=Scope(r["scope"]),
            directive=Directive(r["directive"]),
            criteria=r["criteria"] or {},
            rule_id=r["rule_id"],
            tenant_id=r["tenant_id"],
            waive_code=r["waive_code"],
            reason=r["reason"] or "",
            created_at=r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else str(r["created_at"]),
            _factors=r["factors"] or {},
        )
        for r in rows
    ]


def insert_rule(tenant_id: str, rule: OperatorRule) -> None:
    """Persist a newly-added rule. rule.rule_id must already be assigned (RuleStore.add
    does this before returning) so re-loading on the next restart preserves it."""
    with connect() as conn:
        conn.execute(
            _INSERT_SQL,
            {
                "rule_id": rule.rule_id,
                "tenant_id": tenant_id,
                "scope": rule.scope.value,
                "directive": rule.directive.value,
                "criteria": to_jsonb(rule.criteria),
                "waive_code": rule.waive_code,
                "reason": rule.reason,
                "factors": to_jsonb(rule._factors),
            },
        )
