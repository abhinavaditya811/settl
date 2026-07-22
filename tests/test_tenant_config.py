"""Per-tenant payment-plan template config: config_for()'s Supabase fallback for
a real (non-synthetic) tenant, and the /payment-plan-templates/mine routes."""

import pytest
from fastapi import HTTPException

from settl.api.identity import BoardScope
from settl.api.schemas import PaymentPlanTemplatesBody, PaymentPlanTemplateView
from settl.api.tenant_config_routes import get_my_payment_plan_templates, set_my_payment_plan_templates
from settl.data import tenants as tenants_mod
from settl.tenancy.config import PaymentPlanTemplate


# -- config_for()'s Supabase fallback --------------------------------------------


def test_config_for_unknown_tenant_without_supabase_is_bare_default(monkeypatch):
    monkeypatch.setattr(tenants_mod, "supabase_enabled", lambda: False)
    c = tenants_mod.config_for("some-real-tenant")
    assert c.policy.payment_plan_templates == ()


def test_config_for_reads_supabase_policy_overrides_for_a_real_tenant(monkeypatch):
    monkeypatch.setattr(tenants_mod, "supabase_enabled", lambda: True)
    monkeypatch.setattr(
        tenants_mod, "load_policy_overrides",
        lambda tid: {"payment_plan_templates": [{"installments": 3, "period_days": 30, "label": "x"}]},
    )
    c = tenants_mod.config_for("some-real-tenant")
    assert c.policy.payment_plan_templates == (PaymentPlanTemplate(installments=3, period_days=30, label="x"),)


def test_config_for_demo_tenant_never_touches_supabase(monkeypatch):
    # A demo tenant is resolved from the synthetic fixture - Supabase must not be
    # consulted at all (verified by making it explode if it were).
    def _boom(_tid):
        raise AssertionError("Supabase should not be consulted for a demo tenant")

    monkeypatch.setattr(tenants_mod, "supabase_enabled", lambda: True)
    monkeypatch.setattr(tenants_mod, "load_policy_overrides", _boom)
    c = tenants_mod.config_for("t_brightwork")
    assert c.tenant_id == "t_brightwork"


# -- /payment-plan-templates/mine routes -----------------------------------------


def _scope(tid="tenant-1") -> BoardScope:
    return BoardScope(mode="mine", tenant_ids=frozenset({tid}))


def test_get_my_templates_reflects_config_for(monkeypatch):
    monkeypatch.setattr(
        "settl.api.tenant_config_routes.config_for",
        lambda tid: type("C", (), {"policy": type("P", (), {
            "payment_plan_templates": (PaymentPlanTemplate(installments=2, period_days=14, label="two"),)
        })()})(),
    )
    out = get_my_payment_plan_templates(scope=_scope())
    assert out == [PaymentPlanTemplateView(installments=2, period_days=14, label="two")]


def test_set_my_templates_requires_supabase(monkeypatch):
    monkeypatch.setattr("settl.api.tenant_config_routes.db.supabase_enabled", lambda: False)
    with pytest.raises(HTTPException) as exc:
        set_my_payment_plan_templates(PaymentPlanTemplatesBody(templates=[]), scope=_scope())
    assert exc.value.status_code == 503


def test_set_my_templates_writes_for_the_scoped_tenant(monkeypatch):
    captured = {}
    monkeypatch.setattr("settl.api.tenant_config_routes.db.supabase_enabled", lambda: True)
    monkeypatch.setattr(
        "settl.api.tenant_config_routes.db.set_payment_plan_templates",
        lambda tid, templates: captured.update(tenant_id=tid, templates=templates),
    )
    body = PaymentPlanTemplatesBody(templates=[PaymentPlanTemplateView(installments=4, period_days=60, label="four")])
    out = set_my_payment_plan_templates(body, scope=_scope("tenant-42"))
    assert captured["tenant_id"] == "tenant-42"
    assert captured["templates"] == [{"installments": 4, "period_days": 60, "label": "four"}]
    assert out == body.templates
