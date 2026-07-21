"""Durable PaymentPlan storage (agents/payment_plan/models.py, SCHEMA.md §8).

Mirrors payment_events_store.py's shape. Unlike payment_events (deduped on a
processor reference), a PaymentPlan already has a stable id the moment it's
offered - upsert is keyed on that primary key, so re-saving after a negotiation
round or a vendor decision updates the same row in place (matches the "in-place
amendment" design, never a new row per offer/decision).
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from settl.agents.payment_plan.models import (
    Installment,
    PaymentPlan,
    PaymentPlanSource,
    PaymentPlanStatus,
)
from settl.data.supabase.connection import connect, to_jsonb

_SELECT_SQL = """
    select id, tenant_id, invoice_id, status, installments, source, template_ref,
           offer_count, proposed_at, decided_at, decided_by, contact_ref
    from payment_plans
    order by proposed_at
"""

_UPSERT_SQL = """
    insert into payment_plans (
        id, tenant_id, invoice_id, status, installments, source, template_ref,
        offer_count, proposed_at, decided_at, decided_by, contact_ref, updated_at
    )
    values (
        %(id)s, %(tenant_id)s, %(invoice_id)s, %(status)s, %(installments)s, %(source)s,
        %(template_ref)s, %(offer_count)s, %(proposed_at)s, %(decided_at)s, %(decided_by)s,
        %(contact_ref)s, now()
    )
    on conflict (id) do update set
        status = excluded.status, installments = excluded.installments,
        source = excluded.source, template_ref = excluded.template_ref,
        offer_count = excluded.offer_count, decided_at = excluded.decided_at,
        decided_by = excluded.decided_by, contact_ref = excluded.contact_ref,
        updated_at = now()
"""


def _installment_to_json(i: Installment) -> dict:
    return {
        "index": i.index,
        "amount": str(i.amount),
        "due_date": i.due_date.isoformat(),
        "payment_link": i.payment_link,
        "paid_at": i.paid_at.isoformat() if i.paid_at else None,
    }


def _installment_from_json(row: dict) -> Installment:
    return Installment(
        index=row["index"],
        amount=Decimal(row["amount"]),
        due_date=date.fromisoformat(row["due_date"]),
        payment_link=row.get("payment_link"),
        paid_at=date.fromisoformat(row["paid_at"]) if row.get("paid_at") else None,
    )


def _plan_from_row(r: dict) -> PaymentPlan:
    return PaymentPlan(
        id=r["id"],
        tenant_id=r["tenant_id"],
        invoice_id=r["invoice_id"],
        status=PaymentPlanStatus(r["status"]),
        installments=tuple(_installment_from_json(i) for i in (r["installments"] or [])),
        source=PaymentPlanSource(r["source"]),
        template_ref=r["template_ref"],
        offer_count=r["offer_count"],
        proposed_at=r["proposed_at"],
        decided_at=r["decided_at"],
        decided_by=r["decided_by"],
        contact_ref=r["contact_ref"],
    )


def load_plans() -> dict[str, list[PaymentPlan]]:
    """Every persisted plan, keyed by invoice_id - across every tenant (matches
    the shared-board reality of invoices.py/payment_events_store.py)."""
    with connect() as conn:
        rows = conn.execute(_SELECT_SQL).fetchall()
    out: dict[str, list[PaymentPlan]] = {}
    for r in rows:
        out.setdefault(r["invoice_id"], []).append(_plan_from_row(r))
    return out


def upsert_plan(plan: PaymentPlan) -> None:
    """Persist one plan. Upserts on the plan's own id - an offer, a negotiation
    round, and a vendor decision are all the same row, never a new one."""
    params = {
        "id": plan.id,
        "tenant_id": plan.tenant_id,
        "invoice_id": plan.invoice_id,
        "status": plan.status.value,
        "installments": to_jsonb([_installment_to_json(i) for i in plan.installments]),
        "source": plan.source.value,
        "template_ref": plan.template_ref,
        "offer_count": plan.offer_count,
        "proposed_at": plan.proposed_at,
        "decided_at": plan.decided_at,
        "decided_by": plan.decided_by,
        "contact_ref": plan.contact_ref,
    }
    with connect() as conn:
        conn.execute(_UPSERT_SQL, params)
