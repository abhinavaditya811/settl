"""Render a gate-cleared call script into audio (VOICE_AGENT_SPEC §7, Phase 2).

The thin bridge between a ``CallScript`` and a ``VoiceProvider``: it speaks the
**spoken** leg only - never the companion SMS link line, because a URL is texted, not
read aloud (non-custodial, SCHEMA.md §5). This is what the approval-card play button
and the dev demo both call; it stays pure so it's the same offline (mock) or live.

Order matters and is the caller's responsibility: **render only what the gate cleared.**
Rendering does not gate - it assumes the script already passed the compliance gate, the
same way the sender assumes it. Never render a script the gate escalated.
"""

from __future__ import annotations

from pathlib import Path

from settl.voice.provider import VoiceClip, VoiceProvider
from settl.voice.script import CallScript


def render_script(
    script: CallScript,
    *,
    provider: VoiceProvider,
    voice_id: str = "default",
    out_path: str | Path | None = None,
) -> VoiceClip:
    """Synthesize the spoken leg of ``script`` with ``provider`` in ``voice_id``.

    If ``out_path`` is given the clip is also written there (and the file is created).
    The companion SMS line is intentionally NOT spoken - the link goes out as a text.
    """
    clip = provider.synthesize(script.spoken, voice_id=voice_id)
    if out_path is not None:
        clip.save(out_path)
    return clip
