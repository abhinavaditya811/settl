"""Loads the synthetic tenant configs into canonical ``TenantConfig`` objects.

The data-layer counterpart to ``loader.py`` (which loads invoices): it plays the
role a real persistence layer (Neon, FR-5) will play later, serving a config per
``tenant_id``. The JSON lists only the *policy overrides* a tenant changes; the
loader merges them onto the global defaults via ``policy_with`` - so the override
model (SCHEMA.md §3) is exercised here, and an unknown tenant still gets a valid
default-policy config rather than a special case.
"""

from __future__ import annotations

import json
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

from settl.tenancy.config import (
    Identity,
    Payments,
    PaymentPlanTemplate,
    TenantConfig,
    Voice,
    policy_with,
)

_DATASET = Path(__file__).with_name("synthetic_tenants.json")


def _policy_overrides(raw: dict) -> dict:
    """JSON only knows floats/dicts - coerce the two payment-plan fields that
    aren't plain scalars before handing them to policy_with (a plain dataclass,
    unlike Pydantic, does no coercion of its own - a bare float min_amount would
    later crash comparing against a Decimal amount_due)."""
    overrides = dict(raw)
    if "payment_plan_min_amount" in overrides and overrides["payment_plan_min_amount"] is not None:
        overrides["payment_plan_min_amount"] = Decimal(str(overrides["payment_plan_min_amount"]))
    if "payment_plan_templates" in overrides:
        overrides["payment_plan_templates"] = tuple(
            PaymentPlanTemplate(**t) for t in overrides["payment_plan_templates"]
        )
    return overrides


@lru_cache(maxsize=1)
def load_synthetic_tenants() -> dict[str, TenantConfig]:
    raw = json.loads(_DATASET.read_text())
    out: dict[str, TenantConfig] = {}
    for rec in raw["tenants"]:
        out[rec["tenant_id"]] = TenantConfig(
            tenant_id=rec["tenant_id"],
            identity=Identity(**rec.get("identity", {})),
            payments=Payments(**rec.get("payments", {})),
            voice=Voice(**rec.get("voice", {})),
            # global defaults + overrides
            policy=policy_with(**_policy_overrides(rec.get("policy", {}))),
        )
    return out


def config_for(tenant_id: str) -> TenantConfig:
    """The tenant's config, or a bare default-policy config for an unknown tenant."""
    return load_synthetic_tenants().get(tenant_id, TenantConfig(tenant_id=tenant_id))
