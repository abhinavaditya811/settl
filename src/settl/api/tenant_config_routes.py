"""Payment-plan config for the signed-in vendor's own tenant: templates + the
autonomy opt-in.

Split out from main.py, same reasoning as oauth_routes.py/poll_routes.py. Scoped to
JUST these two payment_plan policy fields (tenant_config.policy's other fields, and
the identity/payments/voice/audio slices, stay out of scope - see
tenant_config_store.py's docstring). "mine" only - there's no demo variant of
configuring a vendor's own settings.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from settl.api.identity import BoardScope, require_mine_scope
from settl.api.schemas import PaymentPlanAutonomyView, PaymentPlanTemplatesBody, PaymentPlanTemplateView
from settl.data import config_for
from settl.data import supabase as db

router = APIRouter()


@router.get("/payment-plan-templates/mine", response_model=list[PaymentPlanTemplateView])
def get_my_payment_plan_templates(scope: BoardScope = Depends(require_mine_scope)) -> list[PaymentPlanTemplateView]:
    tenant_id = next(iter(scope.tenant_ids))
    templates = config_for(tenant_id).policy.payment_plan_templates
    return [PaymentPlanTemplateView(**vars(t)) for t in templates]


@router.put("/payment-plan-templates/mine", response_model=list[PaymentPlanTemplateView])
def set_my_payment_plan_templates(
    body: PaymentPlanTemplatesBody, scope: BoardScope = Depends(require_mine_scope)
) -> list[PaymentPlanTemplateView]:
    """Replace the vendor's full set of templates (not a partial patch - the UI
    always sends the complete list, same shape as the read)."""
    if not db.supabase_enabled():
        raise HTTPException(503, "durable storage is not configured")
    tenant_id = next(iter(scope.tenant_ids))
    db.set_payment_plan_templates(tenant_id, [t.model_dump() for t in body.templates])
    return body.templates


@router.get("/payment-plan-autonomy/mine", response_model=PaymentPlanAutonomyView)
def get_my_payment_plan_autonomy(scope: BoardScope = Depends(require_mine_scope)) -> PaymentPlanAutonomyView:
    tenant_id = next(iter(scope.tenant_ids))
    return PaymentPlanAutonomyView(enabled=config_for(tenant_id).policy.payment_plan_autonomy)


@router.put("/payment-plan-autonomy/mine", response_model=PaymentPlanAutonomyView)
def set_my_payment_plan_autonomy(
    body: PaymentPlanAutonomyView, scope: BoardScope = Depends(require_mine_scope)
) -> PaymentPlanAutonomyView:
    """Whether an explicit vendor approve/reject may confirm a payment plan to the
    debtor (SCHEMA.md §8) - asked at signup (ZeroState.tsx), changeable here."""
    if not db.supabase_enabled():
        raise HTTPException(503, "durable storage is not configured")
    tenant_id = next(iter(scope.tenant_ids))
    db.set_payment_plan_autonomy(tenant_id, body.enabled)
    return body
