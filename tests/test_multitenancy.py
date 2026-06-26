"""Multi-tenant data tagging - the foundation for query-layer isolation (SCHEMA.md §6).

The in-memory synthetic flow doesn't have a DB/RLS layer yet, so these prove the
prerequisite: every invoice is tenant-scoped, tenants partition cleanly with no
leak, and the natural key is unique per tenant. Query-layer isolation builds on this.
"""

from settl.data import load_synthetic_invoices


def test_every_invoice_is_tenant_scoped():
    invs = load_synthetic_invoices()
    assert invs
    assert all(inv.tenant_id for inv in invs)


def test_tenants_partition_cleanly_with_no_leak():
    invs = load_synthetic_invoices()
    by_tenant: dict[str, set[str]] = {}
    for inv in invs:
        by_tenant.setdefault(inv.tenant_id, set()).add(inv.invoice_id)

    assert len(by_tenant) >= 2, "expected the dataset to span multiple tenants"
    seen: set[str] = set()
    for ids in by_tenant.values():
        assert not (ids & seen), "an invoice id leaked across tenants"
        seen |= ids
    assert seen == {inv.invoice_id for inv in invs}  # complete coverage


def test_filtering_by_tenant_returns_only_that_tenant():
    invs = load_synthetic_invoices()
    tenant = invs[0].tenant_id
    scoped = [i for i in invs if i.tenant_id == tenant]
    assert scoped
    assert all(i.tenant_id == tenant for i in scoped)
    assert len(scoped) < len(invs), "another tenant's invoices must exist and be excluded"


def test_natural_key_is_unique_per_tenant():
    # (tenant_id, source, source_ref) is the uniqueness constraint (SCHEMA.md §1).
    invs = load_synthetic_invoices()
    keys = [(i.tenant_id, i.source, i.source_ref) for i in invs]
    assert len(keys) == len(set(keys))
