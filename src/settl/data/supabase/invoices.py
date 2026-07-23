"""Invoices + contacts, read from Supabase Postgres instead of the synthetic
fixture (settl/data/loader.py). Same shape/role: normalizes stored rows into the
canonical Invoice - nothing downstream knows or cares the source is now a table
instead of a JSON file.

as_of_date is never read from a column (there isn't one - SCHEMA.md §6): every
invoice is hydrated with as_of_date=today() here, same as the synthetic loader,
so days_overdue is always computed live.
"""

from __future__ import annotations

from settl.data.supabase.connection import connect
from settl.schema.invoice import Channel, ContactDirection, Invoice, PriorContact

_INVOICES_SQL = """
    select invoice_id, tenant_id, source, source_ref, amount_due, currency,
           issue_date, due_date, status, debtor_name, debtor_email, debtor_phone,
           is_b2b, late_fee_allowed, payment_link, raw
    from invoices
    order by due_date
"""

_CONTACTS_SQL = """
    select invoice_id, direction, channel, occurred_at, summary,
           provider_message_id, in_reply_to, thread_ref, classification, audit_ref
    from contacts
    order by occurred_at
"""


def load_invoices() -> list[Invoice]:
    """Every invoice across every tenant (today's demo board is a single shared
    view, not yet scoped per signed-in user - see api/state.py). Contacts are
    hydrated per invoice into ``prior_contacts`` in one extra query rather than
    N+1 per invoice."""
    with connect() as conn:
        rows = conn.execute(_INVOICES_SQL).fetchall()
        contact_rows = conn.execute(_CONTACTS_SQL).fetchall()

    contacts_by_invoice: dict[str, list[PriorContact]] = {}
    for c in contact_rows:
        contacts_by_invoice.setdefault(c["invoice_id"], []).append(
            PriorContact(
                occurred_on=c["occurred_at"].date(),
                direction=ContactDirection(c["direction"]),
                channel=Channel(c["channel"]),
                summary=c["summary"] or "",
                provider_message_id=c["provider_message_id"],
                in_reply_to=c["in_reply_to"],
                thread_ref=c["thread_ref"],
                classification=c["classification"],
                audit_ref=c["audit_ref"],
            )
        )

    invoices: list[Invoice] = []
    for r in rows:
        invoices.append(
            Invoice(
                invoice_id=r["invoice_id"],
                tenant_id=r["tenant_id"],
                source=r["source"],
                source_ref=r["source_ref"],
                amount_due=r["amount_due"],
                currency=r["currency"],
                issue_date=r["issue_date"],
                due_date=r["due_date"],
                status=r["status"],
                debtor_name=r["debtor_name"],
                debtor_email=r["debtor_email"],
                debtor_phone=r["debtor_phone"],
                is_b2b=r["is_b2b"],
                late_fee_allowed=r["late_fee_allowed"],
                payment_link=r["payment_link"],
                prior_contacts=contacts_by_invoice.get(r["invoice_id"], []),
                raw=r["raw"] or {},
            )
        )
    return invoices
