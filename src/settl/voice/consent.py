"""Bridges a tenant's ``audio`` config into the gate's voice inputs (SPEC §5).

The compliance gate deliberately doesn't import ``tenancy`` - it takes primitives (the
same way contact-frequency bounds arrive as ints, not a ``Policy``). The voice package
is the right place to do that unpacking, because it's allowed to know about both sides.

``voice_context_for`` turns (the tenant ``Audio`` config, the per-debtor call consent,
the intended dial time) into the primitives-only ``VoiceContext`` the voice rules read.
Per-debtor call consent is a Phase-1 input passed in by the caller; Phase 3 wires it to
a real per-debtor consent record (VOICE_AGENT_SPEC §3a.2).
"""

from __future__ import annotations

from datetime import time

from settl.compliance.rules import VoiceContext
from settl.tenancy.config import Audio


def voice_context_for(
    audio: Audio,
    *,
    call_consent: bool,
    now_local: time | None = None,
    opted_out: bool = False,
) -> VoiceContext:
    """Build the gate's ``VoiceContext`` from a tenant's audio config + call consent.

    The call-window bounds come from the tenant's ``audio.call_window``; ``now_local``
    (the intended dial time in the debtor's local zone) is per-call and supplied by the
    caller. Omitting ``now_local`` leaves the window unenforced (nothing to check yet).
    Consent/opt-out arrive as bools here; ``registry.voice_context_from_records`` is
    the sibling that looks them up from the real per-debtor records.
    """
    return VoiceContext(
        call_consent=call_consent,
        now_local=now_local,
        window_start=audio.call_window.start_local,
        window_end=audio.call_window.end_local,
        opted_out=opted_out,
    )
