"""Durable OAuth token storage (SCHEMA.md §4). Mirrors payment_events_store.py's
shape. Only ever stores what security/token_crypto.py already encrypted - this
module never sees a plaintext token, it just persists/retrieves ciphertext."""

from __future__ import annotations

from settl.data.supabase.connection import connect

_UPSERT_SQL = """
    insert into oauth_tokens (tenant_id, provider, encrypted_refresh_token, scopes, updated_at)
    values (%(tenant_id)s, %(provider)s, %(encrypted_refresh_token)s, %(scopes)s, now())
    on conflict (tenant_id, provider) do update set
        encrypted_refresh_token = excluded.encrypted_refresh_token,
        scopes = excluded.scopes,
        updated_at = now()
"""

_SELECT_SQL = """
    select encrypted_refresh_token, scopes
    from oauth_tokens
    where tenant_id = %(tenant_id)s and provider = %(provider)s
"""


def upsert_token(
    tenant_id: str, provider: str, encrypted_refresh_token: str, scopes: list[str]
) -> None:
    """Persist (or replace) a tenant's encrypted refresh token for a provider.
    Re-authorizing (e.g. after a revoke) just overwrites the row - one token per
    (tenant_id, provider), matching the table's unique constraint."""
    with connect() as conn:
        conn.execute(
            _UPSERT_SQL,
            {
                "tenant_id": tenant_id,
                "provider": provider,
                "encrypted_refresh_token": encrypted_refresh_token,
                "scopes": scopes,
            },
        )


def load_token(tenant_id: str, provider: str = "google") -> tuple[str, list[str]] | None:
    """(encrypted_refresh_token, scopes) for this tenant/provider, or None if
    never connected. Callers decrypt via security.token_crypto - this module
    only ever handles ciphertext."""
    with connect() as conn:
        row = conn.execute(_SELECT_SQL, {"tenant_id": tenant_id, "provider": provider}).fetchone()
    if row is None:
        return None
    return row["encrypted_refresh_token"], list(row["scopes"] or [])
