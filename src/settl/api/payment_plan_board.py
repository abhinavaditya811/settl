"""PaymentPlan offer/decide, composed into BoardState (SCHEMA.md §8).

Kept out of state.py (already at CLAUDE.md's 300-400 line cap) as its own small
module - BoardState only holds a thin delegating wrapper. In-memory per-invoice
plan state, mirroring how BoardState holds `_events`/`_results`; persisted via
data/supabase/payment_plans_store.py when Supabase is enabled, same opt-in
pattern as every other durable store here.
"""

from __future__ import annotations

from uuid import uuid4

from dataclasses import replace as dc_replace

from settl.agents.payment_plan import offer_plan, reoffer, select_template
from settl.agents.payment_plan.models import PaymentPlan
from settl.audit.execution_log import ExecutionLog
from settl.data import config_for
from settl.data import supabase as db
from settl.orchestrator import Orchestrator, PipelineResult, decide_payment_plan
from settl.schema.invoice import Invoice
from settl.tenancy.config import PaymentPlanTemplate


class PaymentPlanBoard:
    def __init__(self, *, log: ExecutionLog | None = None) -> None:
        self._log = log
        self._plans: dict[str, PaymentPlan] = {}  # keyed by invoice_id

    def hydrate(self) -> None:
        """Load every durably-persisted plan back into memory - without this, a
        plain restart forgets every offered/proposed/active plan (they're upserted
        on their own id, so nothing was lost durably, but the board couldn't see
        them until the invoice was re-offered, silently creating a duplicate plan
        row). No-op when Supabase is off. Call once, right after construction."""
        if not db.supabase_enabled():
            return
        for invoice_id, plans in db.load_plans().items():
            self._plans[invoice_id] = plans[-1]  # most recently proposed, per invoice

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

    def reoffer(self, invoice: Invoice, template: PaymentPlanTemplate) -> PaymentPlan | None:
        """Re-offer different terms after the debtor asked for them (SCHEMA.md §8)
        - None if there's no plan to amend, or the 3-offer cap is already reached
        (mandatory human handoff, no further auto-offers - the vendor would need a
        fresh manual conversation outside this flow)."""
        plan = self._plans.get(invoice.invoice_id)
        if plan is None or not plan.can_reoffer:
            return None
        new_plan = reoffer(plan, invoice, template)
        self._save(new_plan)
        return new_plan

    def record_negotiation(
        self, invoice_id: str, outcome: str, requested_terms: str | None
    ) -> PaymentPlan | None:
        """Persist the debtor's response to the CURRENT offer, so the vendor sees
        it (PaymentPlanView) before deciding - called from InboundMailBoard when a
        reply lands while a plan is proposed/active. None if there's no plan (the
        caller shouldn't reach here without one, but never guess a plan into
        existence)."""
        plan = self._plans.get(invoice_id)
        if plan is None:
            return None
        updated = dc_replace(plan, negotiation_outcome=outcome, requested_terms=requested_terms)
        self._save(updated)
        return updated

    def _save(self, plan: PaymentPlan) -> None:
        self._plans[plan.invoice_id] = plan
        if db.supabase_enabled():
            db.upsert_plan(plan)
