"""HTTP surface for the Google OAuth flow (settl.api.oauth_google). Split out
from main.py (already at CLAUDE.md's line cap) - included via
``app.include_router(router)``."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from settl.api import oauth_google

router = APIRouter()


@router.get("/oauth/google/authorize")
def google_oauth_authorize(tenant_id: str) -> RedirectResponse:
    """Redirect the vendor's browser to Google's consent screen."""
    try:
        return RedirectResponse(oauth_google.authorize_url(tenant_id))
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))


@router.get("/oauth/google/callback")
def google_oauth_callback(code: str, state: str) -> RedirectResponse:
    """Google redirects here after consent. Exchanges the code, encrypts +
    persists the refresh token, then bounces back to the dashboard."""
    try:
        oauth_google.handle_callback(code, state)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(400, str(exc))
    return RedirectResponse("/")
