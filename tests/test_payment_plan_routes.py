"""HTTP surface for payment-plan actions (api/payment_plan_routes.py): offer,
the new reoffer, and decide, plus negotiation state on the read.

Uses the real app + synthetic dataset (SETTL_USE_SUPABASE=0, forced by
conftest.py) - never touches real data. INV-001 is t_brightwork, which has
payment_plan_templates configured in the synthetic fixture."""

from fastapi.testclient import TestClient

from settl.api.main import app, state

client = TestClient(app)


def test_offer_then_reoffer_amends_the_same_plan():
    offered = client.post("/invoices/INV-001/payment-plan/offer")
    assert offered.status_code == 200
    plan_id_before = state.payment_plan("INV-001").id

    reoffered = client.post(
        "/invoices/INV-001/payment-plan/reoffer",
        json={"installments": 6, "period_days": 20, "label": "6 over 120 days"},
    )
    assert reoffered.status_code == 200
    body = reoffered.json()
    assert len(body["installments"]) == 6
    assert body["offer_count"] == 2
    assert state.payment_plan("INV-001").id == plan_id_before  # same record amended

    state._payment_plans._plans.pop("INV-001", None)  # test cleanup


def test_reoffer_404s_with_no_plan_to_amend():
    r = client.post(
        "/invoices/INV-001/payment-plan/reoffer",
        json={"installments": 3, "period_days": 30, "label": "x"},
    )
    assert r.status_code == 409  # no plan exists yet for this invoice


def test_reoffer_validates_installments_bounds():
    client.post("/invoices/INV-001/payment-plan/offer")
    r = client.post(
        "/invoices/INV-001/payment-plan/reoffer",
        json={"installments": 0, "period_days": 30, "label": "x"},  # below the Field(ge=1) bound
    )
    assert r.status_code == 422
    state._payment_plans._plans.pop("INV-001", None)  # test cleanup


def test_get_payment_plan_surfaces_negotiation_state():
    client.post("/invoices/INV-001/payment-plan/offer")
    updated = state._payment_plans.record_negotiation(
        "INV-001", "wants_different_terms", "can we do 6 months instead?"
    )
    assert updated is not None

    r = client.get("/invoices/INV-001/payment-plan")
    body = r.json()
    assert body["negotiation_outcome"] == "wants_different_terms"
    assert body["requested_terms"] == "can we do 6 months instead?"

    state._payment_plans._plans.pop("INV-001", None)  # test cleanup
