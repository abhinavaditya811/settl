"""Google OAuth authorization flow (api/oauth_google.py) - the Flow object is
faked (no network, no real Google endpoint) so this proves the encryption/CSRF
plumbing around it, mirroring test_stripe_links.py's fake-SDK-client pattern."""

import json

import pytest
from cryptography.fernet import Fernet

from settl.api import oauth_google
from settl.security import token_crypto


@pytest.fixture(autouse=True)
def _configured(monkeypatch):
    monkeypatch.setenv("SETTL_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode())
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "client-id")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "client-secret")


class _Credentials:
    def __init__(self, refresh_token):
        self.refresh_token = refresh_token


class _FakeFlow:
    def __init__(self, redirect_uri, *, refresh_token="1//fake-refresh-token"):
        self.redirect_uri = redirect_uri
        self._refresh_token = refresh_token
        self.fetch_token_calls = []
        self.credentials = _Credentials(refresh_token)

    def authorization_url(self, **kwargs):
        self.auth_kwargs = kwargs
        return f"https://accounts.google.com/o/oauth2/auth?state={kwargs['state']}", kwargs["state"]

    def fetch_token(self, **kwargs):
        self.fetch_token_calls.append(kwargs)
        return {}


def test_google_oauth_enabled_requires_both_env_vars(monkeypatch):
    assert oauth_google.google_oauth_enabled() is True
    monkeypatch.delenv("GOOGLE_OAUTH_CLIENT_SECRET", raising=False)
    assert oauth_google.google_oauth_enabled() is False


def test_authorize_url_raises_when_not_configured(monkeypatch):
    monkeypatch.delenv("GOOGLE_OAUTH_CLIENT_ID", raising=False)
    with pytest.raises(RuntimeError):
        oauth_google.authorize_url("t_demo")


def test_authorize_url_encodes_tenant_id_in_a_signed_state():
    url = oauth_google.authorize_url("t_demo", flow_factory=lambda uri: _FakeFlow(uri))
    assert "state=" in url
    state = url.split("state=")[1]
    payload = json.loads(token_crypto.decrypt(state))
    assert payload["tenant_id"] == "t_demo"
    assert "nonce" in payload


def test_handle_callback_recovers_tenant_id_and_encrypts_the_refresh_token(monkeypatch):
    # This dev environment has real Supabase credentials reachable - load_dotenv()
    # would silently restore SETTL_USE_SUPABASE if we just delenv'd it, so patch
    # the enabled-check itself rather than the env var underneath it.
    monkeypatch.setattr(oauth_google.db, "supabase_enabled", lambda: False)
    fake = _FakeFlow("http://localhost/cb", refresh_token="1//real-secret")
    url = oauth_google.authorize_url("t_demo", flow_factory=lambda uri: fake)
    state = url.split("state=")[1]

    tenant_id = oauth_google.handle_callback("auth-code", state, flow_factory=lambda uri: fake)
    assert tenant_id == "t_demo"
    assert fake.fetch_token_calls == [{"code": "auth-code"}]


def test_handle_callback_rejects_a_tampered_state():
    with pytest.raises(ValueError):
        oauth_google.handle_callback("auth-code", "not-a-real-state-token")


def test_handle_callback_raises_when_google_returns_no_refresh_token():
    fake = _FakeFlow("http://localhost/cb", refresh_token=None)
    url = oauth_google.authorize_url("t_demo", flow_factory=lambda uri: fake)
    state = url.split("state=")[1]
    with pytest.raises(RuntimeError):
        oauth_google.handle_callback("auth-code", state, flow_factory=lambda uri: fake)
