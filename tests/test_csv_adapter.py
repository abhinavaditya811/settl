"""CSV -> canonical Invoice: the strict-header, never-guess contract (Phase 2).
Pure function, no DB - insert_invoices (data/supabase/ingest.py) is covered
separately by the identity/DB-adjacent tests, not here.
"""

import pytest

from settl.adapters.csv_adapter import MAX_ROWS, CsvFormatError, parse_csv

HEADER = "invoice_number,debtor_name,amount_due,issue_date,due_date,is_b2b,debtor_email\n"


def _csv(*rows: str) -> str:
    return HEADER + "\n".join(rows)


def test_valid_rows_are_actionable():
    text = _csv("INV-1,Acme Corp,1000,2026-06-01,2026-06-15,true,ap@acme.test")
    result = parse_csv(text, tenant_id="t_x")
    assert len(result.invoices) == 1
    assert result.invoices[0].invoice_id == "csv-t_x-INV-1"
    assert result.invoices[0].amount_due == 1000
    assert result.invoices[0].is_b2b is True
    assert result.quarantined_ids == []
    assert result.rejected == []


def test_missing_required_header_raises():
    text = "invoice_number,debtor_name,amount_due,issue_date,due_date\nINV-1,Acme,100,2026-06-01,2026-06-15\n"
    with pytest.raises(CsvFormatError):
        parse_csv(text, tenant_id="t_x")


def test_unparseable_amount_is_rejected_not_written():
    text = _csv("INV-1,Acme,not-a-number,2026-06-01,2026-06-15,true,a@b.co")
    result = parse_csv(text, tenant_id="t_x")
    assert result.invoices == []
    assert len(result.rejected) == 1
    assert result.rejected[0].row == 1
    assert any("amount_due" in r for r in result.rejected[0].reasons)


def test_ambiguous_is_b2b_is_rejected():
    text = _csv("INV-1,Acme,100,2026-06-01,2026-06-15,maybe,a@b.co")
    result = parse_csv(text, tenant_id="t_x")
    assert result.invoices == []
    assert any("is_b2b" in r for r in result.rejected[0].reasons)


def test_missing_contact_method_is_quarantined_but_still_written():
    text = _csv("INV-1,Acme,100,2026-06-01,2026-06-15,true,")
    result = parse_csv(text, tenant_id="t_x")
    assert len(result.invoices) == 1  # written...
    assert result.invoices[0].invoice_id in result.quarantined_ids  # ...but quarantined
    assert result.rejected == []


def test_currency_defaults_to_usd_and_late_fee_defaults_false():
    text = _csv("INV-1,Acme,100,2026-06-01,2026-06-15,true,a@b.co")
    inv = parse_csv(text, tenant_id="t_x").invoices[0]
    assert inv.currency == "USD"
    assert inv.late_fee_allowed is False


def test_dollar_sign_and_commas_tolerated_in_amount():
    text = _csv('INV-1,Acme,"$1,200.50",2026-06-01,2026-06-15,true,a@b.co')
    inv = parse_csv(text, tenant_id="t_x").invoices[0]
    assert inv.amount_due == 1200.50


def test_invoice_id_is_deterministic_for_reupload():
    text = _csv("INV-1,Acme,100,2026-06-01,2026-06-15,true,a@b.co")
    first = parse_csv(text, tenant_id="t_x").invoices[0]
    second = parse_csv(text, tenant_id="t_x").invoices[0]
    assert first.invoice_id == second.invoice_id


def test_too_many_rows_rejects_the_whole_file():
    rows = [f"INV-{i},Acme,100,2026-06-01,2026-06-15,true,a@b.co" for i in range(MAX_ROWS + 1)]
    text = _csv(*rows)
    with pytest.raises(CsvFormatError):
        parse_csv(text, tenant_id="t_x")


def test_multiple_rows_independent_reject_vs_accept():
    text = _csv(
        "INV-1,Acme,100,2026-06-01,2026-06-15,true,a@b.co",
        "INV-2,Bad Row,not-a-number,2026-06-01,2026-06-15,true,b@b.co",
    )
    result = parse_csv(text, tenant_id="t_x")
    assert len(result.invoices) == 1
    assert result.invoices[0].source_ref == "INV-1"
    assert len(result.rejected) == 1
    assert result.rejected[0].row == 2
