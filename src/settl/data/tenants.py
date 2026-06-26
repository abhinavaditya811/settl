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
from functools import lru_cache
from pathlib import Path

from settl.tenancy.config import Identity, Payments, TenantConfig, Voice, policy_with

_DATASET = Path(__file__).with_name("synthetic_tenants.json")


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
            policy=policy_with(**rec.get("policy", {})),  # global defaults + overrides
        )
    return out


def config_for(tenant_id: str) -> TenantConfig:
    """The tenant's config, or a bare default-policy config for an unknown tenant."""
    return load_synthetic_tenants().get(tenant_id, TenantConfig(tenant_id=tenant_id))
