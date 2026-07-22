"""Durable per-tenant policy overrides (tenant_config.policy, SCHEMA.md §3).

Scoped to JUST payment_plan_templates for now (the vendor-preapproved installment
options a tenant can offer a debtor - SCHEMA.md §8) - the config_for()'s other
slices (identity/payments/voice/audio) remain out of scope; wiring the rest of
tenant_config is a separate, larger piece of work.

Read-modify-write via a jsonb merge (``policy || jsonb_build_object(...)``) so
setting templates never clobbers other policy fields a tenant may set later
(payment_plan_autonomy, max_touches, ...) that live in the same jsonb column.
"""

from __future__ import annotations

from settl.data.supabase.connection import connect, to_jsonb

_SELECT_SQL = "select policy from tenant_config where tenant_id = %(tenant_id)s"

_UPSERT_SQL = """
    insert into tenant_config (tenant_id, policy)
    values (%(tenant_id)s, jsonb_build_object('payment_plan_templates', %(templates)s::jsonb))
    on conflict (tenant_id) do update
        set policy = tenant_config.policy || jsonb_build_object('payment_plan_templates', %(templates)s::jsonb),
            updated_at = now()
"""


def load_policy_overrides(tenant_id: str) -> dict:
    """The raw policy jsonb for this tenant, or {} if no row exists yet. Callers
    coerce this into a real Policy via tenants.py's _policy_overrides + policy_with
    (same coercion the synthetic-tenant loader already uses)."""
    with connect() as conn:
        row = conn.execute(_SELECT_SQL, {"tenant_id": tenant_id}).fetchone()
    return (row["policy"] if row else None) or {}


def set_payment_plan_templates(tenant_id: str, templates: list[dict]) -> None:
    """Persist the vendor's payment-plan templates for this tenant. ``templates``
    is a list of {installments, period_days, label} dicts - the caller (the API
    route) validates shape before this is called."""
    with connect() as conn:
        conn.execute(_UPSERT_SQL, {"tenant_id": tenant_id, "templates": to_jsonb(templates)})
