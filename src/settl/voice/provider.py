"""The TTS / voice-clone provider seam (VOICE_AGENT_SPEC §5, Phase 2).

One interface, many swappable backends - exactly like the ``Sender`` seam. A backend
turns text into an audio clip (``synthesize``) and, if it can, clones a voice from a
sample (``clone``). Nothing above this layer knows or cares which provider is wired:

  * ``MockVoiceProvider``  - offline default, deterministic, no audio, no network (tests).
  * ``SystemVoiceProvider`` - macOS ``say``; real audio, zero account (system_provider.py).
  * ElevenLabs / Cartesia / Chatterbox - drop in behind this same Protocol when a real
    (paid or heavy-local) voice is wanted; the caller only sets the provider.

Keeping this a thin, pure seam means the gate, the sender, and the render helper never
change when the voice backend does. The provider is chosen at the edge (config/flag).
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, runtime_checkable


class VoiceProviderError(RuntimeError):
    """A voice backend failed (synthesis error, missing binary, bad sample, …)."""


class CloneNotSupported(VoiceProviderError):
    """This backend can only speak stock voices, not clone a new one. Callers that
    need cloning must wire a provider that supports it (ElevenLabs/Cartesia/Chatterbox)."""


@dataclass(frozen=True)
class VoiceClip:
    """A rendered clip: audio bytes + how to read them. Offline the ``mime`` is
    ``text/plain`` (a deterministic stand-in, no real audio); a real backend returns
    ``audio/*``. ``text`` is the script that was spoken - kept for the call artifact."""

    audio: bytes
    mime: str  # "audio/aiff" | "audio/wav" | "audio/mpeg" | "text/plain" (mock)
    voice_id: str
    text: str

    @property
    def is_audio(self) -> bool:
        return self.mime.startswith("audio/")

    def save(self, path: str | Path) -> Path:
        """Write the clip to disk and return the path (for the approval-card player)."""
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(self.audio)
        return p


@runtime_checkable
class VoiceProvider(Protocol):
    name: str

    def synthesize(self, text: str, *, voice_id: str) -> VoiceClip:
        """Render ``text`` in the given voice."""
        ...

    def clone(self, sample: bytes, *, name: str) -> str:
        """Clone a voice from an audio ``sample``; return the new provider voice id."""
        ...


class MockVoiceProvider:
    """Offline default: renders the script as a text 'clip' (no real audio) and
    'clones' by hashing the sample into a stable fake id. Deterministic, no network,
    no binaries - the provider every test and offline run uses."""

    name = "mock"

    def synthesize(self, text: str, *, voice_id: str) -> VoiceClip:
        return VoiceClip(
            audio=text.encode("utf-8"), mime="text/plain", voice_id=voice_id, text=text
        )

    def clone(self, sample: bytes, *, name: str) -> str:
        # Deterministic id from the sample bytes so tests are reproducible.
        digest = hashlib.sha256(sample).hexdigest()[:12]
        return f"cloned_{digest}"
