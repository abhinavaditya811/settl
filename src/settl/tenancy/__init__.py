"""Per-tenant configuration (SCHEMA.md §3). Types only; synthetic data lives in
``settl.data`` (``config_for`` / ``load_synthetic_tenants``)."""

from settl.tenancy.config import (
    DEFAULT_AUDIO,
    DEFAULT_POLICY,
    Audio,
    AudioMode,
    CallWindow,
    ConsentRecord,
    Identity,
    Payments,
    Policy,
    TenantConfig,
    Voice,
    audio_with,
    policy_with,
)

__all__ = [
    "TenantConfig",
    "Identity",
    "Payments",
    "Voice",
    "Audio",
    "AudioMode",
    "CallWindow",
    "ConsentRecord",
    "DEFAULT_AUDIO",
    "audio_with",
    "Policy",
    "DEFAULT_POLICY",
    "policy_with",
]
