"""Google OAuth authorization flow for reading a vendor's Gmail (SCHEMA.md §7).

Kept out of main.py/state.py (both already over CLAUDE.md's 300-400 line cap).
Two functions, matching a standard OAuth 2.0 authorization-code flow:

  * ``authorize_url`` - step 1: build the consent-screen URL for a tenant.
  * ``handle_callback`` - step 2: exchange the code, encrypt the refresh token
    (security/token_crypto.py), persist it (data/supabase/oauth_tokens_store.py).

The `state` param is itself a short-lived Fernet ciphertext carrying the
tenant_id + a nonce - reuses token_crypto's authenticated encryption as CSRF
protection instead of a separate session store (this app has none).

🔌 Verify google-auth-oauthlib's Flow API against current docs before a real
credentials.json/client-secret round trip - the shape here is the standard,
long-stable Google OAuth2 web flow, but confirm against the installed package
version (Flow.from_client_config / authorization_url / fetch_token) per
CLAUDE.md's SDK-verification rule.
"""

from __future__ import annotations

import json
import os
import secrets
from typing import Callable, Protocol

from settl.config import load_dotenv
from settl.data import supabase as db
from settl.security import token_crypto

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
]

_STATE_TTL_SECONDS = 600  # 10 minutes to complete the consent screen


class OAuthFlow(Protocol):
    """The slice of google_auth_oauthlib.flow.Flow this module needs -
    injectable so the exchange can be tested without a real Google round trip."""

    credentials: object
    code_verifier: str | None

    def authorization_url(self, **kwargs) -> tuple[str, str]: ...
    def fetch_token(self, **kwargs) -> dict: ...


FlowFactory = Callable[[str], OAuthFlow]


def google_oauth_enabled() -> bool:
    load_dotenv()
    return bool(
        os.environ.get("GOOGLE_OAUTH_CLIENT_ID") and os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
    )


def _redirect_uri() -> str:
    load_dotenv()
    return os.environ.get("GOOGLE_OAUTH_REDIRECT_URI", "http://localhost:8000/oauth/google/callback")


def _default_flow(redirect_uri: str) -> OAuthFlow:
    from google_auth_oauthlib.flow import Flow  # lazy import: optional extra

    load_dotenv()
    client_id = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
    return Flow.from_client_config(
        {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect_uri],
            }
        },
        scopes=GMAIL_SCOPES,
        redirect_uri=redirect_uri,
    )


def authorize_url(tenant_id: str, *, flow_factory: FlowFactory | None = None) -> str:
    """Step 1: the URL to send the vendor's browser to."""
    if not google_oauth_enabled():
        raise RuntimeError("GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET are not set")
    # PKCE (RFC 7636): the Flow object would auto-generate this itself, but step 1
    # and step 2 each build their own throwaway Flow (this server keeps no session),
    # so the verifier has to be minted here and round-tripped through `state` -
    # otherwise the callback's fresh Flow sends none and Google 400s with
    # "Missing code verifier".
    code_verifier = secrets.token_urlsafe(64)
    state = token_crypto.encrypt(
        json.dumps({
            "tenant_id": tenant_id,
            "nonce": secrets.token_urlsafe(16),
            "code_verifier": code_verifier,
        })
    )
    flow = (flow_factory or _default_flow)(_redirect_uri())
    flow.code_verifier = code_verifier  # pre-set so Flow doesn't autogenerate a different one
    url, _ = flow.authorization_url(
        access_type="offline",  # required to get a refresh token back
        # No include_granted_scopes: this OAuth client is shared with NextAuth
        # sign-in (openid/email/profile), and bundling those into this token's
        # scope response makes oauthlib's scope-changed check raise. This flow
        # only ever wants the two Gmail scopes on the persisted refresh token.
        prompt="consent",  # forces a refresh token even on a re-consent
        state=state,
    )
    return url


def handle_callback(code: str, state: str, *, flow_factory: FlowFactory | None = None) -> str:
    """Step 2: exchange the code, encrypt + persist the refresh token. Returns
    the tenant_id recovered from ``state``. Raises ValueError on a tampered,
    expired, or foreign state token (the CSRF guard) - never guesses a tenant."""
    payload = json.loads(token_crypto.decrypt(state, ttl_seconds=_STATE_TTL_SECONDS))
    tenant_id = payload["tenant_id"]

    flow = (flow_factory or _default_flow)(_redirect_uri())
    flow.code_verifier = payload.get("code_verifier")  # must match the code_challenge from step 1
    flow.fetch_token(code=code)
    credentials = flow.credentials
    refresh_token = getattr(credentials, "refresh_token", None)
    if not refresh_token:
        raise RuntimeError(
            "Google did not return a refresh token - re-consent with prompt=consent "
            "(already set) or revoke prior app access at myaccount.google.com and retry"
        )

    encrypted = token_crypto.encrypt(refresh_token)
    if db.supabase_enabled():
        db.upsert_token(tenant_id, "google", encrypted, GMAIL_SCOPES)
    return tenant_id
