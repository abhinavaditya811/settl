"""HTTP surface for the Google OAuth flow (api/oauth_routes.py) - specifically
the /authorize/mine and /status routes that resolve the tenant from the signed-in
session instead of a caller-supplied tenant_id, so the dashboard can offer one
"Connect Gmail" button with no separate tenant lookup of its own."""

from fastapi.testclient import TestClient

from settl.api import identity
from settl.api import oauth_routes as routes
from settl.api.main import app

client = TestClient(app, follow_redirects=False)


def test_authorize_mine_rejects_without_identity(monkeypatch):
    monkeypatch.setenv("SETTL_INTERNAL_SECRET", "test-secret")
    r = client.get("/oauth/google/authorize/mine")
    assert r.status_code == 401


def test_authorize_mine_redirects_to_google(monkeypatch):
    monkeypatch.setenv("SETTL_INTERNAL_SECRET", "test-secret")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "cid")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "csecret")
    monkeypatch.setattr(identity, "supabase_enabled", lambda: True)
    monkeypatch.setattr(identity, "get_or_create_tenant", lambda sub, email: "t_test_mine")
    r = client.get(
        "/oauth/google/authorize/mine",
        headers={"x-settl-internal-secret": "test-secret", "x-settl-google-sub": "sub-1"},
    )
    assert r.status_code == 307
    assert "accounts.google.com" in r.headers["location"]


def test_status_reports_not_connected(monkeypatch):
    monkeypatch.setenv("SETTL_INTERNAL_SECRET", "test-secret")
    monkeypatch.setattr(identity, "supabase_enabled", lambda: True)
    monkeypatch.setattr(identity, "get_or_create_tenant", lambda sub, email: "t_test_mine")
    monkeypatch.setattr(routes.db, "load_token", lambda tenant_id, provider: None)
    r = client.get(
        "/oauth/google/status",
        headers={"x-settl-internal-secret": "test-secret", "x-settl-google-sub": "sub-1"},
    )
    assert r.status_code == 200
    assert r.json() == {"connected": False}


def test_status_reports_connected(monkeypatch):
    monkeypatch.setenv("SETTL_INTERNAL_SECRET", "test-secret")
    monkeypatch.setattr(identity, "supabase_enabled", lambda: True)
    monkeypatch.setattr(identity, "get_or_create_tenant", lambda sub, email: "t_test_mine")
    monkeypatch.setattr(routes.db, "load_token", lambda tenant_id, provider: ("enc", ["scope"]))
    r = client.get(
        "/oauth/google/status",
        headers={"x-settl-internal-secret": "test-secret", "x-settl-google-sub": "sub-1"},
    )
    assert r.status_code == 200
    assert r.json() == {"connected": True}


def test_callback_redirects_to_the_frontend_dashboard(monkeypatch):
    monkeypatch.setattr(routes.oauth_google, "handle_callback", lambda code, state: "t_test_mine")
    r = client.get("/oauth/google/callback?code=abc&state=xyz")
    assert r.status_code == 307
    assert r.headers["location"] == "http://localhost:3000/dashboard?gmail_connected=1"


# -- graceful failure: every path in this flow redirects, never raw JSON --------


def _boom_value_error(code, state):
    raise ValueError("token ciphertext is invalid, expired, or was encrypted with a different key")


def _boom_runtime_error(code, state):
    raise RuntimeError("Google did not return a refresh token")


def test_callback_redirects_on_expired_or_tampered_state(monkeypatch):
    monkeypatch.setattr(routes.oauth_google, "handle_callback", _boom_value_error)
    r = client.get("/oauth/google/callback?code=abc&state=stale")
    assert r.status_code == 307
    assert r.headers["location"] == "http://localhost:3000/dashboard?gmail_error=expired_link"


def test_callback_redirects_on_handle_callback_runtime_error(monkeypatch):
    monkeypatch.setattr(routes.oauth_google, "handle_callback", _boom_runtime_error)
    r = client.get("/oauth/google/callback?code=abc&state=xyz")
    assert r.status_code == 307
    assert r.headers["location"] == "http://localhost:3000/dashboard?gmail_error=connect_failed"


def test_authorize_mine_redirects_on_not_configured(monkeypatch):
    monkeypatch.setenv("SETTL_INTERNAL_SECRET", "test-secret")
    # This dev environment has real Google OAuth credentials in .env, and
    # load_dotenv() would silently restore a deleted env var (os.environ.
    # setdefault) - patch the enabled-check itself instead, same as
    # test_oauth_google.py does for the same reason.
    monkeypatch.setattr(routes.oauth_google, "google_oauth_enabled", lambda: False)
    monkeypatch.setattr(identity, "supabase_enabled", lambda: True)
    monkeypatch.setattr(identity, "get_or_create_tenant", lambda sub, email: "t_test_mine")
    r = client.get(
        "/oauth/google/authorize/mine",
        headers={"x-settl-internal-secret": "test-secret", "x-settl-google-sub": "sub-1"},
    )
    assert r.status_code == 307
    assert r.headers["location"] == "http://localhost:3000/dashboard?gmail_error=not_configured"
