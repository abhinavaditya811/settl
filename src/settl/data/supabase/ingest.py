"""Write adapter-produced invoices to Postgres (CSV import, manual entry). Upserts
on the table's own natural key (tenant_id, source, source_ref) - mirrors seed.py's
pattern - so re-uploading the same CSV export, or re-adding the same manual
invoice_number, updates in place rather than duplicating.
"""

from __future__ import annotations

from collections.abc import Iterable

from settl.data.supabase.connection import connect, to_jsonb
from settl.schema.invoice import Invoice

_UPSERT_SQL = """
    insert into invoices (invoice_id, tenant_id, source, source_ref, amount_due, currency,
                          issue_date, due_date, status, debtor_name, debtor_email, debtor_phone,
                          is_b2b, late_fee_allowed, payment_link, raw)
    values (%(invoice_id)s, %(tenant_id)s, %(source)s, %(source_ref)s, %(amount_due)s, %(currency)s,
            %(issue_date)s, %(due_date)s, %(status)s, %(debtor_name)s, %(debtor_email)s, %(debtor_phone)s,
            %(is_b2b)s, %(late_fee_allowed)s, %(payment_link)s, %(raw)s)
    on conflict (tenant_id, source, source_ref) do update set
        amount_due = excluded.amount_due, currency = excluded.currency,
        issue_date = excluded.issue_date, due_date = excluded.due_date,
        status = excluded.status, debtor_name = excluded.debtor_name,
        debtor_email = excluded.debtor_email, debtor_phone = excluded.debtor_phone,
        is_b2b = excluded.is_b2b, late_fee_allowed = excluded.late_fee_allowed,
        payment_link = excluded.payment_link, raw = excluded.raw, updated_at = now()
"""


def insert_invoices(invoices: Iterable[Invoice]) -> None:
    with connect() as conn:
        for inv in invoices:
            conn.execute(
                _UPSERT_SQL,
                {
                    "invoice_id": inv.invoice_id,
                    "tenant_id": inv.tenant_id,
                    "source": inv.source.value,
                    "source_ref": inv.source_ref,
                    "amount_due": inv.amount_due,
                    "currency": inv.currency,
                    "issue_date": inv.issue_date,
                    "due_date": inv.due_date,
                    "status": inv.status.value,
                    "debtor_name": inv.debtor_name,
                    "debtor_email": inv.debtor_email,
                    "debtor_phone": inv.debtor_phone,
                    "is_b2b": inv.is_b2b,
                    "late_fee_allowed": inv.late_fee_allowed,
                    "payment_link": inv.payment_link,
                    "raw": to_jsonb(inv.raw),
                },
            )
