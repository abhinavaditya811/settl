"""macOS ``say`` voice backend - real audio, zero account, zero install (Phase 2).

The free default-voice provider for dev: it turns the gate-cleared script into an
actual AIFF you can hear, so the pipeline is demonstrably end-to-end before anyone
signs up for (or pays for) ElevenLabs/Cartesia. It is deliberately limited:

  * it speaks stock system voices only - it CANNOT clone, so ``clone`` raises
    ``CloneNotSupported`` (cloning needs a real provider, wired later); and
  * it only exists on macOS (``say``), so it's guarded and never imported eagerly by
    the offline default (that stays ``MockVoiceProvider``).

Same ``VoiceProvider`` seam as everything else - swap it for a real backend by changing
one line at the edge; nothing above it moves.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from settl.voice.provider import CloneNotSupported, VoiceClip, VoiceProviderError

# Map our provider-neutral voice ids onto concrete macOS voices. "default" is the
# stock professional voice; a raw macOS voice name (e.g. "Alex") is also accepted.
_VOICE_MAP = {
    "default": "Samantha",
}
_FALLBACK_VOICE = "Samantha"


class SystemVoiceProvider:
    name = "system_say"

    def __init__(self, *, binary: str = "say") -> None:
        if sys.platform != "darwin":
            raise VoiceProviderError(
                "SystemVoiceProvider needs macOS `say`; use MockVoiceProvider or a "
                "real TTS provider on this platform."
            )
        resolved = shutil.which(binary)
        if resolved is None:
            raise VoiceProviderError(f"`{binary}` not found on PATH.")
        self._say = resolved

    def synthesize(self, text: str, *, voice_id: str) -> VoiceClip:
        voice = _VOICE_MAP.get(voice_id, voice_id or _FALLBACK_VOICE)
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "clip.aiff"
            try:
                subprocess.run(
                    [self._say, "-v", voice, "-o", str(out), text],
                    check=True, capture_output=True, timeout=60,
                )
            except subprocess.CalledProcessError as exc:  # bad voice name, etc.
                stderr = exc.stderr.decode("utf-8", "replace").strip()
                raise VoiceProviderError(f"`say` failed: {stderr}") from exc
            except subprocess.TimeoutExpired as exc:
                raise VoiceProviderError("`say` timed out") from exc
            audio = out.read_bytes()
        return VoiceClip(audio=audio, mime="audio/aiff", voice_id=voice, text=text)

    def clone(self, sample: bytes, *, name: str) -> str:
        raise CloneNotSupported(
            "macOS `say` speaks stock voices only - wire ElevenLabs/Cartesia/Chatterbox "
            "to clone a voice."
        )
