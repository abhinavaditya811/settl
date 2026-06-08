"""Schema + validation/quarantine guarantees."""

import pytest
from pydantic import ValidationError

from settl.data import load_synthetic_invoices, reference_date
from settl.schema import partition_invoices


def _by_id(invoices):
    return {inv.invoice_id: inv for inv in invoices}


def test_dataset_loads_about_25():
    invoices = load_synthetic_invoices()
    assert len(invoices) == 25


def test_days_overdue_is_computed_not_trusted():
    inv = _by_id(load_synthetic_invoices())
    # as_of is 2026-06-08; due 2026-06-01 → exactly 7 days overdue.
    assert reference_date().isoformat() == "2026-06-08"
    assert inv["INV-001"].days_overdue == 7
    # The fixture never carries days_overdue; it's derived from due_date.
    assert "days_overdue" not in inv["INV-001"].raw


def test_future_due_date_is_negative_overdue():
    inv = _by_id(load_synthetic_invoices())
    assert inv["INV-010"].days_overdue < 0  # not yet due


def test_invoice_is_immutable():
    inv = load_synthetic_invoices()[0]
    with pytest.raises(ValidationError):
        inv.amount_due = 1  # frozen model


def test_malformed_invoice_is_quarantined():
    actionable, quarantined = partition_invoices(load_synthetic_invoices())
    quarantined_ids = {inv.invoice_id for inv, _ in quarantined}
    assert "INV-011" in quarantined_ids  # zero amount + missing contact
    assert "INV-011" not in {inv.invoice_id for inv in actionable}
    # The reasons name the bad fields, never a guess.
    issues = next(iss for inv, iss in quarantined if inv.invoice_id == "INV-011")
    fields = {i.field for i in issues}
    assert {"amount_due", "debtor_contact"} <= fields
