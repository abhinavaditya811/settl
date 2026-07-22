"""On-demand polling routes (Stripe payments, inbound Gmail). Split out from
main.py (already at CLAUDE.md's line cap) - ``build_router(state)`` because,
unlike oauth_routes.py, these touch the BoardState singleton main.py owns."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from settl.api import inbound_poll_scheduler
from settl.api.identity import BoardScope, board_scope
from settl.api.schemas import CheckInboundMailResponse, CheckPaymentsResponse
from settl.api.state import BoardState


def build_router(state: BoardState) -> APIRouter:
    router = APIRouter()

    @router.post("/check-inbound-mail", response_model=CheckInboundMailResponse)
    def check_inbound_mail(tenant_id: str) -> CheckInboundMailResponse:
        """Poll one tenant's Gmail (SCHEMA.md §7). Ops/manual trigger by tenant_id -
        the dashboard uses /check-inbound-mail/mine instead (no tenant_id needed)."""
        changed = state.poll_inbound_mail(tenant_id)
        inbound_poll_scheduler.record_poll(tenant_id)
        return CheckInboundMailResponse(changed=changed)

    @router.post("/check-inbound-mail/mine", response_model=CheckInboundMailResponse)
    def check_inbound_mail_mine(scope: BoardScope = Depends(board_scope)) -> CheckInboundMailResponse:
        """Poll every tenant in view - lets the dashboard auto-poll without knowing a
        tenant_id (mirrors /check-payments), on demand instead of the ~2min cycle."""
        changed: list[str] = []
        for tenant_id in scope.tenant_ids:
            changed.extend(state.poll_inbound_mail(tenant_id))
            inbound_poll_scheduler.record_poll(tenant_id)
        return CheckInboundMailResponse(changed=changed)

    @router.post("/check-payments", response_model=CheckPaymentsResponse)
    def check_payments() -> CheckPaymentsResponse:
        """Poll Stripe for paid links and auto-reconcile (record fee, notify,
        RECOVERED). No-op when Stripe isn't armed. The dashboard polls this so
        payment reflects on its own - no manual marking."""
        return CheckPaymentsResponse(recovered=state.check_payments())

    return router
