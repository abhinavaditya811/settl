"""Board scope: which tenant(s) a request may see (Phase 1, FR-6).

Two views:
  * "demo" (default) - the synthetic demo tenants, exactly today's behavior.
  * "mine" - the signed-in operator's own tenant only, resolved from a Google `sub`
    the Next.js proxy forwards over the shared-secret-verified boundary
    (internal_auth.py). Fails closed: a missing/invalid secret, a missing sub, or
    Supabase being off never falls back to "show everything" - the caller gets a
    clear 401/503 instead.

tenant_ids is always a concrete frozenset (never None), so a route can filter with
a plain membership check with no "no filter = show all tenants" footgun.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from fastapi import Header, HTTPException, Query

from settl.api.internal_auth import verify_internal_secret
from settl.data import load_synthetic_tenants
from settl.data.supabase import get_or_create_tenant, supabase_enabled


@lru_cache(maxsize=1)
def demo_tenant_ids() -> frozenset[str]:
    return frozenset(load_synthetic_tenants().keys())


@dataclass(frozen=True)
class BoardScope:
    mode: str  # "demo" | "mine"
    tenant_ids: frozenset[str]


def _resolve_mine(secret: str | None, google_sub: str | None, email: str | None) -> BoardScope:
    if not verify_internal_secret(secret):
        raise HTTPException(401, "missing or invalid internal secret")
    if not google_sub:
        raise HTTPException(401, "missing signed-in identity")
    if not supabase_enabled():
        raise HTTPException(503, "durable storage is not configured")
    tenant_id = get_or_create_tenant(google_sub, email or "")
    return BoardScope(mode="mine", tenant_ids=frozenset({tenant_id}))


def board_scope(
    view: str = Query("demo", pattern="^(demo|mine)$"),
    x_settl_internal_secret: str | None = Header(None),
    x_settl_google_sub: str | None = Header(None),
    x_settl_user_email: str | None = Header(None),
) -> BoardScope:
    """Read-route dependency: defaults to the demo view so any caller that doesn't
    send `view` keeps getting today's behavior unchanged."""
    if view == "demo":
        return BoardScope(mode="demo", tenant_ids=demo_tenant_ids())
    return _resolve_mine(x_settl_internal_secret, x_settl_google_sub, x_settl_user_email)


def require_mine_scope(
    x_settl_internal_secret: str | None = Header(None),
    x_settl_google_sub: str | None = Header(None),
    x_settl_user_email: str | None = Header(None),
) -> BoardScope:
    """Intake-route dependency (CSV/manual import): always "mine" - there is no demo
    variant of adding your own invoices."""
    return _resolve_mine(x_settl_internal_secret, x_settl_google_sub, x_settl_user_email)
