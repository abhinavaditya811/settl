"""Get-or-create a tenants row for a signed-in operator (Phase 1, FR-6).

Keyed by Google's `sub` (the OIDC subject id), never email - an email can change or
be reused across accounts; `sub` is the one stable identifier NextAuth gives us.
One atomic upsert (not a select-then-insert) so two concurrent first requests from
the same brand-new account can't race into two rows.
"""

from __future__ import annotations

from settl.data.supabase.connection import connect

_UPSERT_SQL = """
    insert into tenants (google_sub, email, display_name)
    values (%(google_sub)s, %(email)s, %(email)s)
    on conflict (google_sub) do update set email = excluded.email, updated_at = now()
    returning id
"""

_SELECT_EMAIL_SQL = "select email from tenants where id = %(tenant_id)s"


def get_or_create_tenant(google_sub: str, email: str) -> str:
    with connect() as conn:
        row = conn.execute(_UPSERT_SQL, {"google_sub": google_sub, "email": email}).fetchone()
        return row["id"]


def get_tenant_email(tenant_id: str) -> str | None:
    """The operator's own registered email (the account they signed in with) -
    for notifications that must reach THEM, not the shared SMTP send account
    (agents/reconcile/notify.py's "recovered"/"needs review" notices)."""
    with connect() as conn:
        row = conn.execute(_SELECT_EMAIL_SQL, {"tenant_id": tenant_id}).fetchone()
    return row["email"] if row else None
