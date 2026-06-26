"""Run a mixed-tenant batch with per-tenant isolation.

Honours the SCHEMA.md §6 rule: **one orchestrator/sender per tenant per run.** It
groups invoices by ``tenant_id`` and runs each group under an ``Orchestrator`` built
from that tenant's ``TenantConfig`` - so a tenant's default pay link, policy bounds,
and voice apply only to its own invoices, and no agent instance is ever shared across
tenants. ``config_for`` resolves a tenant_id to its config (e.g. ``settl.data.config_for``).
"""

from __future__ import annotations

from typing import Callable

from settl.audit.execution_log import ExecutionLog
from settl.orchestrator.pipeline import Orchestrator
from settl.orchestrator.result import PipelineResult
from settl.schema.invoice import Invoice
from settl.tenancy.config import TenantConfig

ConfigLookup = Callable[[str], TenantConfig]


def run_multitenant(
    invoices: list[Invoice],
    config_for: ConfigLookup,
    *,
    log: ExecutionLog | None = None,
) -> list[PipelineResult]:
    """Group by tenant, run each group under its own tenant-scoped Orchestrator.

    Results preserve the input order. A fresh Orchestrator (and thus sender/gate) is
    built per tenant - never shared - which is the isolation guarantee."""
    by_tenant: dict[str, list[Invoice]] = {}
    for inv in invoices:
        by_tenant.setdefault(inv.tenant_id, []).append(inv)

    results: dict[str, PipelineResult] = {}
    for tenant_id, group in by_tenant.items():
        orch = Orchestrator(log=log, config=config_for(tenant_id))
        for res in orch.run_batch(group):
            results[res.invoice_id] = res

    return [results[inv.invoice_id] for inv in invoices]
