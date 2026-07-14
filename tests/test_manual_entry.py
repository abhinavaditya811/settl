from datetime import date
from decimal import Decimal

from settl.adapters.manual_entry import ManualInvoiceInput, build_manual_invoice
from settl.schema.invoice import Source
from settl.schema.validation import validate_invoice


def _payload(**over) -> ManualInvoiceInput:
    base = dict(
        debtor_name="Acme Corp",
        amount_due=Decimal("500"),
        issue_date=date(2026, 6, 1),
        due_date=date(2026, 6, 15),
        is_b2b=True,
        debtor_email="ap@acme.test",
    )
    base.update(over)
    return ManualInvoiceInput(**base)


def test_builds_actionable_invoice():
    inv = build_manual_invoice("t_x", _payload())
    assert inv.source is Source.MANUAL
    assert inv.tenant_id == "t_x"
    assert validate_invoice(inv) == []


def test_blank_invoice_number_generates_a_random_ref():
    inv = build_manual_invoice("t_x", _payload())
    assert len(inv.source_ref) == 10  # bare hex, no redundant "manual-" prefix
    assert inv.invoice_id == f"manual-t_x-{inv.source_ref}"


def test_explicit_invoice_number_used_as_source_ref():
    inv = build_manual_invoice("t_x", _payload(invoice_number="INV-42"))
    assert inv.source_ref == "INV-42"
    assert inv.invoice_id == "manual-t_x-INV-42"


def test_missing_contact_method_is_quarantined_by_validation():
    inv = build_manual_invoice("t_x", _payload(debtor_email=None, debtor_phone=None))
    assert validate_invoice(inv) != []
