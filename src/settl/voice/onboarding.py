"""Voice-clone onboarding (VOICE_AGENT_SPEC §2, §3a.3, §7 - Phase 2).

The opt-in path where a business owner turns their OWN recorded sample into a cloned
voice. The one invariant that lives here, enforced before anything else happens:

  * **No clone without active consent.** We call ``provider.clone`` only after a valid,
    non-revoked clone ``ConsentRecord`` is on file - never a debtor's or a third party's
    voice, only the owner's own, and always logged + revocable.

Declining is a first-class path: a tenant that doesn't onboard a clone simply keeps the
default voice (``default_audio``). This module only builds the ``Audio`` config; it does
not itself dial, gate, or synthesize.
"""

from __future__ import annotations

from settl.tenancy.config import Audio, AudioMode, ConsentRecord, audio_with
from settl.voice.provider import VoiceProvider


class ConsentRequired(RuntimeError):
    """Refused to clone: no active clone consent on file. We never clone a voice
    without logged, non-revoked consent from its owner."""


def onboard_clone(
    sample: bytes,
    consent: ConsentRecord,
    *,
    provider: VoiceProvider,
    default_voice_id: str = "default",
    name: str = "owner",
) -> Audio:
    """Clone the owner's voice from ``sample`` and return a cloned ``Audio`` config.

    ``consent`` MUST be an active clone consent - otherwise we refuse (``ConsentRequired``)
    and never touch the provider. On success the returned ``Audio`` is in ``cloned`` mode
    with the new provider voice id, the consent record attached, and the default voice id
    preserved as the always-available fallback.
    """
    if consent.kind != "clone":
        raise ConsentRequired(f"expected a 'clone' consent, got '{consent.kind}'.")
    if not consent.active:
        raise ConsentRequired("clone consent is revoked - cannot clone.")

    voice_id = provider.clone(sample, name=name)
    return audio_with(
        enabled=True,
        mode=AudioMode.CLONED,
        provider=provider.name,
        voice_id=voice_id,
        default_voice_id=default_voice_id,
        clone_consent=consent,
    )
