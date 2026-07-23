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
    assert inv.invoice_id.startswith("manual-")
    assert "t_x" not in inv.invoice_id  # compact: no embedded tenant id


def test_explicit_invoice_number_used_as_source_ref():
    inv = build_manual_invoice("t_x", _payload(invoice_number="INV-42"))
    assert inv.source_ref == "INV-42"
    # Compact id keeps the human invoice number, drops the tenant UUID, adds a
    # short uniquifier: "manual-INV-42-<6hex>".
    assert inv.invoice_id.startswith("manual-INV-42-")
    assert "t_x" not in inv.invoice_id


def test_manual_invoice_ids_are_globally_unique():
    a = build_manual_invoice("t_x", _payload(invoice_number="INV-42"))
    b = build_manual_invoice("t_y", _payload(invoice_number="INV-42"))  # same number, different tenant
    assert a.invoice_id != b.invoice_id  # the random suffix keeps the global PK unique


def test_invoice_number_with_spaces_yields_a_whitespace_free_id():
    inv = build_manual_invoice("t_x", _payload(invoice_number="INV 42 / draft"))
    assert " " not in inv.invoice_id  # correlation extracts the trailing token


def test_missing_contact_method_is_quarantined_by_validation():
    inv = build_manual_invoice("t_x", _payload(debtor_email=None, debtor_phone=None))
    assert validate_invoice(inv) != []
