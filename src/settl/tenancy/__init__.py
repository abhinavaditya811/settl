"""Per-tenant configuration (SCHEMA.md §3). Types only; synthetic data lives in
``settl.data`` (``config_for`` / ``load_synthetic_tenants``)."""

from settl.tenancy.config import (
    DEFAULT_POLICY,
    Identity,
    Payments,
    Policy,
    TenantConfig,
    Voice,
    policy_with,
)

__all__ = [
    "TenantConfig",
    "Identity",
    "Payments",
    "Voice",
    "Policy",
    "DEFAULT_POLICY",
    "policy_with",
]
