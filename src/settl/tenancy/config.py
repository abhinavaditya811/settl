"""Per-tenant configuration (SCHEMA.md §3).

One ``TenantConfig`` per vendor, in four slices, each injected into the agent that
needs it: ``identity`` + ``payments`` → sender, ``policy`` → gate (as inputs, never
a second gate), ``voice`` → drafting. The object passed around agents carries only
**refs** for secrets (``oauth_token_ref``, ``stripe_connection_ref``), never the
token/key itself.

``policy`` is "global defaults + per-tenant override": the dataclass defaults ARE the
global policy (and match the engine's built-in thresholds, so an un-configured run is
unchanged); a tenant overrides only the fields it changes via ``policy_with(...)``.
A tenant can only make the gate *stricter* (e.g. lower ``max_touches``), never bypass it.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace


@dataclass(frozen=True)
class Identity:
    business_name: str = ""
    from_address: str | None = None  # From: = the vendor's own address (first-party)
    oauth_token_ref: str | None = None  # pointer into oauth_tokens, NEVER the token


@dataclass(frozen=True)
class Payments:
    default_payment_link: str | None = None  # step 3 of the resolution chain (§5)
    stripe_connection_ref: str | None = None  # pointer to the vendor's connected Stripe


@dataclass(frozen=True)
class Voice:
    voice_block: str = ""  # grounding for drafting (the "customer's voice")
    signature: str = ""


@dataclass(frozen=True)
class Policy:
    """Gate/strategy inputs. Defaults mirror the engine's built-in thresholds."""

    success_fee_pct: float = 7.5  # recorded, never collected (non-custodial)
    allowed_tones: tuple[str, ...] = (
        "friendly_reminder",
        "firm_reminder",
        "final_notice",
    )
    max_touches: int = 3  # contact-frequency ceiling (feeds the gate)
    frequency_window_days: int = 7
    min_days_between_touches: int = 2


DEFAULT_POLICY = Policy()


def policy_with(**overrides) -> Policy:
    """A Policy that starts from the global defaults and overrides only what's given."""
    return replace(DEFAULT_POLICY, **overrides)


@dataclass(frozen=True)
class TenantConfig:
    tenant_id: str
    identity: Identity = field(default_factory=Identity)
    payments: Payments = field(default_factory=Payments)
    voice: Voice = field(default_factory=Voice)
    policy: Policy = DEFAULT_POLICY
