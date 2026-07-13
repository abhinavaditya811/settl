"""Durable payment events (settl/agents/reconcile/events.py, SCHEMA.md §5).

BoardState's in-memory ``_events`` dict is cleared on every refresh() (a fresh
run must not double-count); persisting here is what lets reconcile state survive
a process restart - reload on refresh(), then replay ``_apply_reconcile`` per
invoice so a RECOVERED/PARTIAL invoice doesn't silently reset to its
pre-reconcile terminal state after a redeploy.

Upsert is keyed on (tenant_id, reference) where reference is non-empty (the same
dedup key BoardState._record_event already uses in memory, backed here by
payment_events_reference_uniq) - a re-poll or a webhook retry updates the row
rather than stacking a duplicate.
"""

from __future__ import annotations

from settl.agents.reconcile import PaymentEvent, PaymentEventKind
from settl.data.supabase.connection import connect

_SELECT_SQL = """
    select invoice_id, kind, amount, currency, occurred_on, source, reference
    from payment_events
    order by created_at
"""

_UPSERT_SQL = """
    insert into payment_events (tenant_id, invoice_id, kind, amount, currency, occurred_on, source, reference)
    values (%(tenant_id)s, %(invoice_id)s, %(kind)s, %(amount)s, %(currency)s, %(occurred_on)s, %(source)s, %(reference)s)
    on conflict (tenant_id, reference) where reference <> ''
    do update set kind = excluded.kind, amount = excluded.amount, occurred_on = excluded.occurred_on
"""

_INSERT_NO_REFERENCE_SQL = """
    insert into payment_events (tenant_id, invoice_id, kind, amount, currency, occurred_on, source, reference)
    values (%(tenant_id)s, %(invoice_id)s, %(kind)s, %(amount)s, %(currency)s, %(occurred_on)s, %(source)s, %(reference)s)
"""


def load_events() -> dict[str, list[PaymentEvent]]:
    """Every persisted event, keyed by invoice_id - across every tenant (matches
    the shared-board reality of load_invoices())."""
    with connect() as conn:
        rows = conn.execute(_SELECT_SQL).fetchall()
    out: dict[str, list[PaymentEvent]] = {}
    for r in rows:
        out.setdefault(r["invoice_id"], []).append(
            PaymentEvent(
                invoice_id=r["invoice_id"],
                amount=r["amount"],
                occurred_on=r["occurred_on"],
                currency=r["currency"],
                kind=PaymentEventKind(r["kind"]),
                source=r["source"],
                reference=r["reference"] or "",
            )
        )
    return out


def upsert_event(tenant_id: str, event: PaymentEvent) -> None:
    """Persist one event. A blank reference (e.g. a manual/synthetic event with no
    processor id) is never deduped - it always inserts a new row, mirroring the
    partial unique index (payment_events_reference_uniq only covers reference<>'')."""
    params = {
        "tenant_id": tenant_id,
        "invoice_id": event.invoice_id,
        "kind": event.kind.value,
        "amount": event.amount,
        "currency": event.currency,
        "occurred_on": event.occurred_on,
        "source": event.source,
        "reference": event.reference,
    }
    sql = _UPSERT_SQL if event.reference else _INSERT_NO_REFERENCE_SQL
    with connect() as conn:
        conn.execute(sql, params)
