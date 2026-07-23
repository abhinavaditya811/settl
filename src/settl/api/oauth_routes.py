"""HTTP surface for the Google OAuth flow (settl.api.oauth_google). Split out
from main.py (already at CLAUDE.md's line cap) - included via
``app.include_router(router)``."""

from __future__ import annotations

import os
from urllib.parse import quote

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse

from settl.api import oauth_google
from settl.api.identity import BoardScope, require_mine_scope
from settl.data import supabase as db

router = APIRouter()

# Where the browser lands after consent - the Next.js app, never this API's own
# port (main.py has no "/" route; a plain RedirectResponse("/") here 404s).
_FRONTEND_URL = os.environ.get("SETTL_FRONTEND_URL", "http://localhost:3000")


def _error_redirect(code: str) -> RedirectResponse:
    """Every failure in this flow lands the browser back on the dashboard with a
    short error code, never a raw JSON body - this whole flow is reached by real
    browser navigations (Google's own redirect, or a plain <a> click), not a
    fetch() call a frontend can catch and format. GmailConnect.tsx reads
    ?gmail_error= and shows a friendly message."""
    return RedirectResponse(f"{_FRONTEND_URL}/dashboard?gmail_error={quote(code)}")


@router.get("/oauth/google/authorize")
def google_oauth_authorize(tenant_id: str) -> RedirectResponse:
    """Redirect the vendor's browser to Google's consent screen. Caller-supplied
    tenant_id - useful for manual/admin connects; the dashboard's own "Connect
    Gmail" button uses /authorize/mine below instead."""
    try:
        return RedirectResponse(oauth_google.authorize_url(tenant_id))
    except RuntimeError:
        return _error_redirect("not_configured")


@router.get("/oauth/google/authorize/mine")
def google_oauth_authorize_mine(scope: BoardScope = Depends(require_mine_scope)) -> RedirectResponse:
    """Same flow, but resolves the tenant from the signed-in operator's own
    identity instead of a caller-supplied tenant_id - so the frontend can offer
    one "Connect Gmail" button with no separate tenant lookup of its own."""
    tenant_id = next(iter(scope.tenant_ids))
    try:
        return RedirectResponse(oauth_google.authorize_url(tenant_id))
    except RuntimeError:
        return _error_redirect("not_configured")


@router.get("/oauth/google/status")
def google_oauth_status(scope: BoardScope = Depends(require_mine_scope)) -> dict:
    """Whether the signed-in operator's tenant already has a Gmail token on
    file - lets the dashboard show "Connected"/"Connect Gmail" without guessing."""
    tenant_id = next(iter(scope.tenant_ids))
    return {"connected": db.load_token(tenant_id, "google") is not None}


@router.get("/oauth/google/callback")
def google_oauth_callback(code: str, state: str) -> RedirectResponse:
    """Google redirects here after consent. Exchanges the code, encrypts +
    persists the refresh token, then bounces back to the dashboard. A stale or
    reused link (state token past its 10-minute TTL, or a state.py restart with
    a different SETTL_TOKEN_ENCRYPTION_KEY) is a routine, expected failure here -
    not a 500, and never a raw JSON body a real user would see."""
    try:
        oauth_google.handle_callback(code, state)
    except ValueError:
        return _error_redirect("expired_link")
    except RuntimeError:
        return _error_redirect("connect_failed")
    return RedirectResponse(f"{_FRONTEND_URL}/dashboard?gmail_connected=1")
