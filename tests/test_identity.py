"""Phase 1: the internal-secret gate and demo/mine board-scope resolution.

FastAPI is publicly reachable directly, so these are the only things standing
between a forged header and reading/writing another operator's invoices - test
the fail-closed paths as carefully as the happy path.
"""

import pytest
from fastapi import HTTPException

from settl.api import identity
from settl.api.internal_auth import verify_internal_secret


# -- verify_internal_secret -----------------------------------------------------


def test_secret_unset_never_trusts(monkeypatch):
    monkeypatch.delenv("SETTL_INTERNAL_SECRET", raising=False)
    assert verify_internal_secret("anything") is False


def test_secret_missing_provided_value(monkeypatch):
    monkeypatch.setenv("SETTL_INTERNAL_SECRET", "s3cret")
    assert verify_internal_secret(None) is False


def test_secret_mismatch(monkeypatch):
    monkeypatch.setenv("SETTL_INTERNAL_SECRET", "s3cret")
    assert verify_internal_secret("wrong") is False


def test_secret_match(monkeypatch):
    monkeypatch.setenv("SETTL_INTERNAL_SECRET", "s3cret")
    assert verify_internal_secret("s3cret") is True


# -- demo_tenant_ids --------------------------------------------------------------


def test_demo_tenant_ids_matches_synthetic_fixture():
    ids = identity.demo_tenant_ids()
    assert ids == frozenset({"t_brightwork", "t_harborside"})


# -- board_scope / require_mine_scope --------------------------------------------


def test_board_scope_defaults_to_demo():
    scope = identity.board_scope(view="demo")
    assert scope.mode == "demo"
    assert scope.tenant_ids == identity.demo_tenant_ids()


def test_mine_scope_rejects_missing_secret(monkeypatch):
    monkeypatch.setenv("SETTL_INTERNAL_SECRET", "s3cret")
    with pytest.raises(HTTPException) as exc:
        identity.board_scope(view="mine", x_settl_internal_secret=None, x_settl_google_sub="sub-1")
    assert exc.value.status_code == 401


def test_mine_scope_rejects_wrong_secret(monkeypatch):
    monkeypatch.setenv("SETTL_INTERNAL_SECRET", "s3cret")
    with pytest.raises(HTTPException) as exc:
        identity.board_scope(view="mine", x_settl_internal_secret="wrong", x_settl_google_sub="sub-1")
    assert exc.value.status_code == 401


def test_mine_scope_rejects_missing_sub(monkeypatch):
    monkeypatch.setenv("SETTL_INTERNAL_SECRET", "s3cret")
    with pytest.raises(HTTPException) as exc:
        identity.board_scope(view="mine", x_settl_internal_secret="s3cret", x_settl_google_sub=None)
    assert exc.value.status_code == 401


def test_mine_scope_rejects_when_supabase_disabled(monkeypatch):
    monkeypatch.setenv("SETTL_INTERNAL_SECRET", "s3cret")
    monkeypatch.setattr(identity, "supabase_enabled", lambda: False)
    with pytest.raises(HTTPException) as exc:
        identity.board_scope(view="mine", x_settl_internal_secret="s3cret", x_settl_google_sub="sub-1")
    assert exc.value.status_code == 503


def test_mine_scope_resolves_tenant_when_valid(monkeypatch):
    monkeypatch.setenv("SETTL_INTERNAL_SECRET", "s3cret")
    monkeypatch.setattr(identity, "supabase_enabled", lambda: True)
    monkeypatch.setattr(identity, "get_or_create_tenant", lambda sub, email: f"tenant-for-{sub}")
    scope = identity.require_mine_scope(
        x_settl_internal_secret="s3cret", x_settl_google_sub="sub-1", x_settl_user_email="a@b.com",
    )
    assert scope.mode == "mine"
    assert scope.tenant_ids == frozenset({"tenant-for-sub-1"})
