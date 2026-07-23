"""Payment-plan action routes for one invoice (SCHEMA.md §8): read, offer,
vendor-constructed reoffer, and the vendor's decide.

Split out from main.py (already at CLAUDE.md's line cap), same reasoning as
poll_routes.py - ``build_router(state)`` because these touch the BoardState
singleton main.py owns.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from settl.api.schemas import (
    InstallmentView,
    PaymentPlanDecisionBody,
    PaymentPlanDecisionResponse,
    PaymentPlanTemplateView,
    PaymentPlanView,
)
from settl.api.state import BoardState
from settl.tenancy.config import PaymentPlanTemplate


def _plan_view(invoice_id: str, plan) -> PaymentPlanView:
    return PaymentPlanView(
        invoice_id=invoice_id,
        status=plan.status.value,
        installments=[
            InstallmentView(
                index=i.index, amount=str(i.amount), due_date=i.due_date.isoformat(),
                payment_link=i.payment_link,
                paid_at=i.paid_at.isoformat() if i.paid_at else None,
            )
            for i in plan.installments
        ],
        source=plan.source.value,
        template_ref=plan.template_ref,
        offer_count=plan.offer_count,
        can_reoffer=plan.can_reoffer,
        negotiation_outcome=plan.negotiation_outcome,
        requested_terms=plan.requested_terms,
    )


def build_router(state: BoardState) -> APIRouter:
    router = APIRouter()

    @router.get("/invoices/{invoice_id}/payment-plan", response_model=PaymentPlanView)
    def get_payment_plan(invoice_id: str) -> PaymentPlanView:
        if not state.get(invoice_id):
            raise HTTPException(404, f"unknown invoice {invoice_id}")
        plan = state.payment_plan(invoice_id)
        if plan is None:
            raise HTTPException(404, f"no payment plan offered for {invoice_id}")
        return _plan_view(invoice_id, plan)

    @router.post("/invoices/{invoice_id}/payment-plan/offer", response_model=PaymentPlanView)
    def offer_payment_plan(invoice_id: str) -> PaymentPlanView:
        """Offer the vendor's first-configured template (SCHEMA.md §8). 404s if the
        tenant has no payment_plan_templates configured - nothing to offer."""
        if not state.get(invoice_id):
            raise HTTPException(404, f"unknown invoice {invoice_id}")
        plan = state.offer_payment_plan(invoice_id)
        if plan is None:
            raise HTTPException(409, f"{invoice_id}'s tenant has no payment-plan templates configured")
        return _plan_view(invoice_id, plan)

    @router.post("/invoices/{invoice_id}/payment-plan/reoffer", response_model=PaymentPlanView)
    def reoffer_payment_plan(invoice_id: str, body: PaymentPlanTemplateView) -> PaymentPlanView:
        """Vendor-constructed terms (free-form, not limited to a saved template)
        after the debtor asked for something different. 409s with no plan to
        amend, or the 3-offer cap already reached (mandatory human handoff)."""
        if not state.get(invoice_id):
            raise HTTPException(404, f"unknown invoice {invoice_id}")
        template = PaymentPlanTemplate(
            installments=body.installments, period_days=body.period_days, label=body.label,
        )
        plan = state.reoffer_payment_plan(invoice_id, template)
        if plan is None:
            raise HTTPException(409, f"{invoice_id} has no plan to amend, or its offer cap is reached")
        return _plan_view(invoice_id, plan)

    @router.post("/invoices/{invoice_id}/payment-plan/decide", response_model=PaymentPlanDecisionResponse)
    def decide_payment_plan(invoice_id: str, body: PaymentPlanDecisionBody) -> PaymentPlanDecisionResponse:
        """Vendor approve/reject on an offered plan. The engine decides the outcome
        (re-running the compliance gate on approval) - this route only projects it."""
        if not state.get(invoice_id):
            raise HTTPException(404, f"unknown invoice {invoice_id}")
        out = state.decide_payment_plan(invoice_id, body.approved)
        if out is None:
            raise HTTPException(409, f"{invoice_id} has no offered payment plan to decide")
        return PaymentPlanDecisionResponse(**out)

    return router
