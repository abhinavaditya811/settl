"""Per-tenant configuration (SCHEMA.md §3).

One ``TenantConfig`` per vendor, in slices, each injected into the agent that
needs it: ``identity`` + ``payments`` → sender, ``policy`` → gate (as inputs, never
a second gate), ``voice`` → drafting, ``audio`` → the voice channel. The object
passed around agents carries only **refs** for secrets (``oauth_token_ref``,
``stripe_connection_ref``), never the token/key itself.

Note the two "voice" slices are deliberately different things (VOICE_AGENT_SPEC §1.5):
``voice`` is the *writing persona* (CustomerVoiceProfile - how words are phrased, all
channels, grounding only, never touches the gate); ``audio`` is the *spoken voice* for
the phone channel (default vs cloned) and DOES feed new voice compliance rules.

``policy`` is "global defaults + per-tenant override": the dataclass defaults ARE the
global policy (and match the engine's built-in thresholds, so an un-configured run is
unchanged); a tenant overrides only the fields it changes via ``policy_with(...)``.
A tenant can only make the gate *stricter* (e.g. lower ``max_touches``), never bypass it.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import time
from enum import Enum


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


# --- audio / phone-channel config (VOICE_AGENT_SPEC §4) -----------------------
# The SPOKEN voice for the phone channel. Separate from ``Voice`` above (the writing
# persona) - see the module docstring. Additions only; no existing slice changes.


class AudioMode(str, Enum):
    DEFAULT = "default"  # neutral stock voice - works out of the box
    CLONED = "cloned"  # the owner's own cloned voice (opt-in, needs consent)


@dataclass(frozen=True)
class ConsentRecord:
    """One logged, revocable consent (clone / call / recording). The audit basis
    for anything the voice agent does; ``revoked_at`` set → no longer active."""

    kind: str  # "clone" | "call" | "recording"
    granted_by: str  # owner/user id who granted it
    granted_at: str  # ISO timestamp
    method: str = "checkbox"  # "checkbox" | "oral_on_call" | "signed"
    evidence_ref: str | None = None  # pointer to the audio sample / signed doc
    revoked_at: str | None = None

    @property
    def active(self) -> bool:
        return self.revoked_at is None


@dataclass(frozen=True)
class CallWindow:
    """Allowed local call hours. Dialing outside this window escalates at the gate."""

    start_local: time = time(8, 0)
    end_local: time = time(21, 0)

    def contains(self, t: time) -> bool:
        return self.start_local <= t <= self.end_local


@dataclass(frozen=True)
class Audio:
    enabled: bool = False  # voice channel is off unless a tenant opts in
    mode: AudioMode = AudioMode.DEFAULT
    provider: str = "elevenlabs"  # TTS/clone provider (behind a seam)
    voice_id: str | None = None  # the cloned voice id (only when mode == cloned)
    default_voice_id: str = "default"  # stock fallback, always set
    clone_consent: ConsentRecord | None = None  # required + active to use a clone
    call_window: CallWindow = field(default_factory=CallWindow)
    # When strategy may PICK the voice channel (spec §9.4): voice is an escalation
    # step, not a first touch - only this overdue, only after emails/texts didn't
    # land. Strategy inputs only; the gate still judges every call independently.
    min_days_overdue: int = 30
    min_prior_touches: int = 2
    # Mid-call human handoff: the vendor's number a live call transfers to when the
    # debtor disputes / asks for a plan / wants a person. None → no transfer leg.
    escalation_number: str | None = None
    # Per-tenant facts the live agent may draw on for simple questions ("how do I
    # get a copy of the invoice?"). Plain text, injected per call - one shared
    # platform agent, never a per-tenant agent build. Facts only, never policy.
    business_facts: str = ""
    # Whether calls are recorded (drives the spoken recording disclosure).
    record_calls: bool = False

    @property
    def active_voice_id(self) -> str:
        """The voice id we'd actually speak with. A clone is used only when the tenant
        opted in AND has an active clone consent on file; otherwise we fall back to the
        default voice (never speak in a cloned voice without logged consent)."""
        if (
            self.mode is AudioMode.CLONED
            and self.voice_id
            and self.clone_consent is not None
            and self.clone_consent.active
        ):
            return self.voice_id
        return self.default_voice_id


DEFAULT_AUDIO = Audio()


def audio_with(**overrides) -> Audio:
    """An Audio config from the defaults, overriding only the given fields."""
    return replace(DEFAULT_AUDIO, **overrides)


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
    voice: Voice = field(default_factory=Voice)  # writing persona (drafting grounding)
    audio: Audio = DEFAULT_AUDIO  # spoken voice for the phone channel
    policy: Policy = DEFAULT_POLICY
