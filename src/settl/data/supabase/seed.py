"""One-time (idempotent) seed: synthetic_invoices.json / synthetic_tenants.json ->
Supabase tables. Run with:

    SETTL_USE_SUPABASE=1 .venv/bin/python -m settl.data.supabase.seed

Safe to re-run: every insert is an upsert keyed on the same natural id the
fixture already uses, so re-seeding never duplicates rows. This is fixture data
only (CLAUDE.md: synthetic data is for building/testing logic ONLY, never
revenue/customer evidence) - real vendor data arrives through the CSV/Stripe
adapters (FR-11), never through this script.
"""

from __future__ import annotations

from settl.data.loader import load_synthetic_invoices
from settl.data.supabase.connection import connect, to_jsonb
from settl.data.tenants import load_synthetic_tenants

_UPSERT_TENANT_SQL = """
    insert into tenants (id, email, display_name)
    values (%(id)s, %(email)s, %(display_name)s)
    on conflict (id) do update set display_name = excluded.display_name
"""

_UPSERT_INVOICE_SQL = """
    insert into invoices (invoice_id, tenant_id, source, source_ref, amount_due, currency,
                          issue_date, due_date, status, debtor_name, debtor_email, debtor_phone,
                          is_b2b, late_fee_allowed, payment_link, raw)
    values (%(invoice_id)s, %(tenant_id)s, %(source)s, %(source_ref)s, %(amount_due)s, %(currency)s,
            %(issue_date)s, %(due_date)s, %(status)s, %(debtor_name)s, %(debtor_email)s, %(debtor_phone)s,
            %(is_b2b)s, %(late_fee_allowed)s, %(payment_link)s, %(raw)s)
    on conflict (invoice_id) do update set
        amount_due = excluded.amount_due, status = excluded.status,
        payment_link = excluded.payment_link, raw = excluded.raw
"""

_CLEAR_SEEDED_CONTACTS_SQL = "delete from contacts where invoice_id = %(invoice_id)s"

_INSERT_CONTACT_SQL = """
    insert into contacts (tenant_id, invoice_id, direction, channel, occurred_at, summary)
    values (%(tenant_id)s, %(invoice_id)s, %(direction)s, %(channel)s, %(occurred_at)s, %(summary)s)
"""


def seed() -> None:
    tenants = load_synthetic_tenants()
    invoices = load_synthetic_invoices()

    with connect() as conn:
        for tenant_id, cfg in tenants.items():
            conn.execute(
                _UPSERT_TENANT_SQL,
                {
                    "id": tenant_id,
                    "email": cfg.identity.from_address or f"{tenant_id}@example.invalid",
                    "display_name": cfg.identity.business_name or tenant_id,
                },
            )

        for inv in invoices:
            conn.execute(
                _UPSERT_INVOICE_SQL,
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
            # The fixture's prior_contacts have no stable id - re-seeding replaces
            # this invoice's contact rows rather than growing them unbounded.
            conn.execute(_CLEAR_SEEDED_CONTACTS_SQL, {"invoice_id": inv.invoice_id})
            for c in inv.prior_contacts:
                conn.execute(
                    _INSERT_CONTACT_SQL,
                    {
                        "tenant_id": inv.tenant_id,
                        "invoice_id": inv.invoice_id,
                        "direction": c.direction.value,
                        "channel": c.channel.value,
                        "occurred_at": c.occurred_on,
                        "summary": c.summary,
                    },
                )

    print(f"Seeded {len(tenants)} tenants, {len(invoices)} invoices.")


if __name__ == "__main__":
    seed()
