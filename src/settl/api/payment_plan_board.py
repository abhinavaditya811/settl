"""PaymentPlan offer/decide, composed into BoardState (SCHEMA.md §8).

Kept out of state.py (already at CLAUDE.md's 300-400 line cap) as its own small
module - BoardState only holds a thin delegating wrapper. In-memory per-invoice
plan state, mirroring how BoardState holds `_events`/`_results`; persisted via
data/supabase/payment_plans_store.py when Supabase is enabled, same opt-in
pattern as every other durable store here.
"""

from __future__ import annotations

from uuid import uuid4

from settl.agents.payment_plan import offer_plan, select_template
from settl.agents.payment_plan.models import PaymentPlan
from settl.audit.execution_log import ExecutionLog
from settl.data import config_for
from settl.data import supabase as db
from settl.orchestrator import Orchestrator, PipelineResult, decide_payment_plan
from settl.schema.invoice import Invoice


class PaymentPlanBoard:
    def __init__(self, *, log: ExecutionLog | None = None) -> None:
        self._log = log
        self._plans: dict[str, PaymentPlan] = {}  # keyed by invoice_id

    def get(self, invoice_id: str) -> PaymentPlan | None:
        return self._plans.get(invoice_id)

    def all(self) -> dict[str, PaymentPlan]:
        """Every plan currently held, keyed by invoice_id - read by
        InboundMailBoard.poll to route a reply into negotiation vs. the
        generic inbound lanes (SCHEMA.md §7/§8)."""
        return dict(self._plans)

    def offer(self, invoice: Invoice) -> PaymentPlan | None:
        """Offer the vendor's first-configured template. None if the tenant has
        no templates configured (nothing to offer) - the caller (the inbound
        payment-plan-request lane) falls back to a plain human escalation."""
        templates = config_for(invoice.tenant_id).policy.payment_plan_templates
        template = select_template(templates)
        if template is None:
            return None
        plan = offer_plan(invoice, template, plan_id=str(uuid4()))
        self._save(plan)
        return plan

    def decide(
        self, orchestrator: Orchestrator, invoice: Invoice, approved: bool
    ) -> tuple[PaymentPlan, PipelineResult] | None:
        plan = self._plans.get(invoice.invoice_id)
        if plan is None:
            return None
        new_plan, result = decide_payment_plan(orchestrator, invoice, plan, approved)
        self._save(new_plan)
        return new_plan, result

    def _save(self, plan: PaymentPlan) -> None:
        self._plans[plan.invoice_id] = plan
        if db.supabase_enabled():
            db.upsert_plan(plan)
