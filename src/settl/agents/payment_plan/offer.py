"""Build a PROPOSED PaymentPlan offering one of the vendor's preapproved templates
(SCHEMA.md §8). Pure - no I/O, no model call; picking and pricing a template is
deterministic, not a judgment call.

Currency-correct: splits amount_due in minor units (payments/currency.py, the same
helper reconcile uses) so cents are never lost or duplicated across installments -
the last installment absorbs any remainder, so the sum always equals amount_due
exactly.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import date, timedelta
from decimal import Decimal

from settl.agents.payment_plan.models import (
    Installment,
    PaymentPlan,
    PaymentPlanSource,
    PaymentPlanStatus,
)
from settl.payments.currency import from_minor_units, to_minor_units
from settl.schema.invoice import Invoice
from settl.tenancy.config import PaymentPlanTemplate


def select_template(
    templates: tuple[PaymentPlanTemplate, ...],
) -> PaymentPlanTemplate | None:
    """The first vendor-configured template - vendors list them in the order
    they'd want offered. None if the tenant hasn't configured any."""
    return templates[0] if templates else None


def build_installments(
    amount_due: Decimal, currency: str, template: PaymentPlanTemplate, *, start: date
) -> tuple[Installment, ...]:
    minor_total = to_minor_units(amount_due, currency)
    n = template.installments
    base = minor_total // n
    remainder = minor_total - base * n  # absorbed by the last installment
    installments = []
    for i in range(n):
        minor_amount = base + (remainder if i == n - 1 else 0)
        due = start + timedelta(days=template.period_days * (i + 1))
        installments.append(
            Installment(index=i, amount=from_minor_units(minor_amount, currency), due_date=due)
        )
    return tuple(installments)


def offer_plan(invoice: Invoice, template: PaymentPlanTemplate, *, plan_id: str) -> PaymentPlan:
    """Build a new PROPOSED plan offering ``template`` for ``invoice``."""
    installments = build_installments(
        invoice.amount_due, invoice.currency, template, start=invoice.as_of_date
    )
    return PaymentPlan(
        id=plan_id,
        tenant_id=invoice.tenant_id,
        invoice_id=invoice.invoice_id,
        status=PaymentPlanStatus.PROPOSED,
        installments=installments,
        source=PaymentPlanSource.TEMPLATE,
        template_ref=template.label or f"{template.installments}x{template.period_days}d",
        offer_count=1,
        proposed_at=invoice.as_of_date,
    )


def reoffer(plan: PaymentPlan, invoice: Invoice, template: PaymentPlanTemplate) -> PaymentPlan:
    """A rejected plan re-offering a (possibly different) template - amends the
    same record in place and bumps offer_count, never creates a new plan row."""
    installments = build_installments(
        invoice.amount_due, invoice.currency, template, start=invoice.as_of_date
    )
    return replace(
        plan,
        status=PaymentPlanStatus.PROPOSED,
        installments=installments,
        source=PaymentPlanSource.TEMPLATE,
        template_ref=template.label or f"{template.installments}x{template.period_days}d",
        offer_count=plan.offer_count + 1,
        decided_at=None,
        decided_by=None,
        # A fresh offer supersedes whatever the debtor said about the LAST one.
        negotiation_outcome=None,
        requested_terms=None,
    )
