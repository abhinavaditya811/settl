"""Durable per-tenant policy overrides (tenant_config.policy, SCHEMA.md §3).

Scoped to JUST the two payment-plan fields for now (payment_plan_templates - the
vendor-preapproved installment options; payment_plan_autonomy - whether the vendor
opted in to letting an explicit approve/reject confirm a plan) - config_for()'s
other slices (identity/payments/voice/audio) remain out of scope; wiring the rest
of tenant_config is a separate, larger piece of work.

Read-modify-write via a jsonb merge (``policy || jsonb_build_object(...)``) so
setting one field never clobbers another that lives in the same jsonb column.
"""

from __future__ import annotations

from settl.data.supabase.connection import connect, to_jsonb

_SELECT_SQL = "select policy from tenant_config where tenant_id = %(tenant_id)s"

_MERGE_SQL = """
    insert into tenant_config (tenant_id, policy)
    values (%(tenant_id)s, jsonb_build_object(%(key)s::text, %(value)s::jsonb))
    on conflict (tenant_id) do update
        set policy = tenant_config.policy || jsonb_build_object(%(key)s::text, %(value)s::jsonb),
            updated_at = now()
"""


def load_policy_overrides(tenant_id: str) -> dict:
    """The raw policy jsonb for this tenant, or {} if no row exists yet. Callers
    coerce this into a real Policy via tenants.py's _policy_overrides + policy_with
    (same coercion the synthetic-tenant loader already uses)."""
    with connect() as conn:
        row = conn.execute(_SELECT_SQL, {"tenant_id": tenant_id}).fetchone()
    return (row["policy"] if row else None) or {}


def _merge_policy_field(tenant_id: str, key: str, value) -> None:
    with connect() as conn:
        conn.execute(_MERGE_SQL, {"tenant_id": tenant_id, "key": key, "value": to_jsonb(value)})


def set_payment_plan_templates(tenant_id: str, templates: list[dict]) -> None:
    """Persist the vendor's payment-plan templates for this tenant. ``templates``
    is a list of {installments, period_days, label} dicts - the caller (the API
    route) validates shape before this is called."""
    _merge_policy_field(tenant_id, "payment_plan_templates", templates)


def set_payment_plan_autonomy(tenant_id: str, enabled: bool) -> None:
    """Persist whether this vendor opted into letting an explicit approve/reject
    confirm a payment plan to the debtor (SCHEMA.md §8) - asked at signup
    (web/src/components/zero/ZeroState.tsx), changeable later in the Profile tab."""
    _merge_policy_field(tenant_id, "payment_plan_autonomy", enabled)
