"""PaymentPlanBoard (api/payment_plan_board.py) - offer/reoffer/record_negotiation,
in-memory + durable save. `db.*` calls monkeypatched directly on the module object
(never touches a real database)."""

from datetime import date, timedelta
from decimal import Decimal

from settl.api import payment_plan_board as ppb
from settl.agents.payment_plan.models import Installment, PaymentPlan, PaymentPlanStatus
from settl.schema.invoice import Invoice, InvoiceStatus, Source
from settl.tenancy.config import PaymentPlanTemplate


def _invoice(inv_id="INV-1", tenant_id="t_demo") -> Invoice:
    today = date.today()
    return Invoice(
        invoice_id=inv_id, tenant_id=tenant_id, source=Source.CSV, source_ref="x",
        amount_due=Decimal("900.00"), currency="USD",
        issue_date=today - timedelta(days=40), due_date=today - timedelta(days=10),
        status=InvoiceStatus.OPEN, debtor_name="Acme", debtor_email="ap@acme.test",
        is_b2b=True, late_fee_allowed=True, as_of_date=today,
    )


def _plan(invoice_id="INV-1", **overrides) -> PaymentPlan:
    base = dict(
        id="pp-1", tenant_id="t_demo", invoice_id=invoice_id, status=PaymentPlanStatus.PROPOSED,
        installments=(Installment(index=0, amount=Decimal("300"), due_date=date.today()),),
        offer_count=1,
    )
    base.update(overrides)
    return PaymentPlan(**base)


def test_record_negotiation_persists_outcome_and_terms(monkeypatch):
    monkeypatch.setattr(ppb.db, "supabase_enabled", lambda: False)
    board = ppb.PaymentPlanBoard()
    board._plans["INV-1"] = _plan()

    updated = board.record_negotiation("INV-1", "wants_different_terms", "6 months instead")

    assert updated.negotiation_outcome == "wants_different_terms"
    assert updated.requested_terms == "6 months instead"
    assert board.get("INV-1") is updated  # in-memory state actually changed


def test_record_negotiation_none_when_no_plan():
    board = ppb.PaymentPlanBoard()
    assert board.record_negotiation("no-such-invoice", "accepted", None) is None


def test_record_negotiation_saves_durably_when_supabase_on(monkeypatch):
    saved = []
    monkeypatch.setattr(ppb.db, "supabase_enabled", lambda: True)
    monkeypatch.setattr(ppb.db, "upsert_plan", lambda plan: saved.append(plan))
    board = ppb.PaymentPlanBoard()
    board._plans["INV-1"] = _plan()

    board.record_negotiation("INV-1", "accepted", None)

    assert len(saved) == 1
    assert saved[0].negotiation_outcome == "accepted"


def test_reoffer_amends_in_place_and_clears_negotiation_state(monkeypatch):
    monkeypatch.setattr(ppb.db, "supabase_enabled", lambda: False)
    board = ppb.PaymentPlanBoard()
    board._plans["INV-1"] = _plan(negotiation_outcome="wants_different_terms", requested_terms="6 months")

    new_template = PaymentPlanTemplate(installments=6, period_days=30, label="6 over 180 days")
    result = board.reoffer(_invoice(), new_template)

    assert result.id == "pp-1"  # same record, not a new plan
    assert len(result.installments) == 6
    assert result.negotiation_outcome is None  # cleared - superseded by the new offer
    assert result.requested_terms is None
    assert board.get("INV-1") is result


def test_reoffer_none_when_no_plan():
    board = ppb.PaymentPlanBoard()
    template = PaymentPlanTemplate(installments=3, period_days=30)
    assert board.reoffer(_invoice(), template) is None


def test_reoffer_none_when_offer_cap_reached():
    board = ppb.PaymentPlanBoard()
    board._plans["INV-1"] = _plan(offer_count=3)  # MAX_OFFER_COUNT
    template = PaymentPlanTemplate(installments=3, period_days=30)
    assert board.reoffer(_invoice(), template) is None


def test_hydrate_picks_up_negotiation_fields(monkeypatch):
    persisted = _plan(negotiation_outcome="accepted", requested_terms=None)
    monkeypatch.setattr(ppb.db, "supabase_enabled", lambda: True)
    monkeypatch.setattr(ppb.db, "load_plans", lambda: {"INV-1": [persisted]})
    board = ppb.PaymentPlanBoard()
    board.hydrate()
    assert board.get("INV-1").negotiation_outcome == "accepted"
