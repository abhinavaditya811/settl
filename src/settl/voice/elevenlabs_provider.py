"""ElevenLabs voice backend - real TTS + instant voice cloning (Phase 2, live).

The first real provider behind the ``VoiceProvider`` seam. Same shape as every other
backend, so nothing above it (gate, sender, render, onboarding) changes:

  * ``synthesize`` works on ANY key, including the free tier (stock voices, ~10k
    credits/mo, no commercial rights - dev/demo only).
  * ``clone`` (Instant Voice Cloning) requires the Starter plan or above; on a free
    key ElevenLabs refuses and we surface that as ``CloneNotSupported`` with the fix.

Setup: drop a key in the gitignored ``.env`` as ``ELEVENLABS_API_KEY``. Endpoints
verified against the current API reference (POST /v1/text-to-speech/{voice_id},
POST /v1/voices/add) - not coded from memory. Uses only the stdlib (urllib), so the
core package gains no dependency; HTTP goes through the module-level ``_request`` so
tests monkeypatch it and stay hermetic (the same trick test_senders plays on smtplib).
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
import uuid

from settl.config import load_dotenv
from settl.voice.provider import CloneNotSupported, VoiceClip, VoiceProviderError

_API_BASE = "https://api.elevenlabs.io/v1"
_DEFAULT_MODEL = "eleven_multilingual_v2"  # ElevenLabs' recommended default
_TIMEOUT_SECS = 60

# Map our provider-neutral ids onto ElevenLabs stock voices. "default" must be a
# PREMADE voice (in every account's My Voices): free keys get 402 on *library*
# voices via the API, so a library id here would break the free-tier path. Sarah
# ("mature, reassuring, confident") fits a payment reminder; any raw id also works.
_VOICE_MAP = {
    "default": "EXAVITQu4vr4xnSDxMaL",  # Sarah (premade - free-tier safe)
}


def _request(
    url: str, *, headers: dict[str, str], data: bytes, method: str = "POST"
) -> tuple[int, bytes]:
    """One HTTP round-trip → (status, body). Non-2xx comes back as a status too
    (never an exception), so the provider can map API errors to clear messages."""
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT_SECS) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as exc:  # 4xx/5xx - body carries the API's reason
        return exc.code, exc.read()
    except urllib.error.URLError as exc:  # DNS/offline/timeout
        raise VoiceProviderError(f"ElevenLabs unreachable: {exc.reason}") from exc


def _api_detail(body: bytes) -> str:
    """Best-effort human-readable reason out of an ElevenLabs error body."""
    try:
        detail = json.loads(body.decode("utf-8", "replace")).get("detail")
    except (json.JSONDecodeError, AttributeError):
        return body.decode("utf-8", "replace")[:200]
    if isinstance(detail, dict):  # {"status": ..., "message": ...}
        return str(detail.get("message") or detail)
    return str(detail)[:200]


class ElevenLabsProvider:
    name = "elevenlabs"

    def __init__(self, api_key: str | None = None, *, model_id: str = _DEFAULT_MODEL) -> None:
        load_dotenv()  # surface a .env-provided key, same as the Gemini client does
        self._key = api_key or os.environ.get("ELEVENLABS_API_KEY")
        if not self._key:
            raise VoiceProviderError(
                "No ElevenLabs key. Put ELEVENLABS_API_KEY=... in the gitignored .env "
                "(free tier speaks stock voices; cloning needs the Starter plan)."
            )
        self._model_id = model_id

    def synthesize(self, text: str, *, voice_id: str) -> VoiceClip:
        vid = _VOICE_MAP.get(voice_id, voice_id)
        body = json.dumps({"text": text, "model_id": self._model_id}).encode("utf-8")
        status, payload = _request(
            f"{_API_BASE}/text-to-speech/{vid}",
            headers={"xi-api-key": self._key, "Content-Type": "application/json"},
            data=body,
        )
        if status != 200:
            raise VoiceProviderError(f"ElevenLabs TTS failed ({status}): {_api_detail(payload)}")
        # Default output_format is mp3_44100_128 → an MP3 stream.
        return VoiceClip(audio=payload, mime="audio/mpeg", voice_id=vid, text=text)

    def clone(self, sample: bytes, *, name: str) -> str:
        """Instant Voice Clone from one audio sample → the new provider voice id.

        Only ever called by ``onboard_clone`` AFTER the consent check - this method
        assumes consent was already enforced upstream and just talks to the API."""
        boundary = uuid.uuid4().hex
        data = _multipart(boundary, name=name, sample=sample)
        status, payload = _request(
            f"{_API_BASE}/voices/add",
            headers={
                "xi-api-key": self._key,
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            },
            data=data,
        )
        if status in (401, 403):  # free tier / missing permission → not a bug, a plan
            raise CloneNotSupported(
                f"ElevenLabs refused the clone ({status}): {_api_detail(payload)}. "
                "Instant Voice Cloning needs the Starter plan or above."
            )
        if status != 200:
            raise VoiceProviderError(f"ElevenLabs clone failed ({status}): {_api_detail(payload)}")
        try:
            voice_id = json.loads(payload.decode("utf-8"))["voice_id"]
        except (json.JSONDecodeError, KeyError) as exc:
            raise VoiceProviderError("ElevenLabs clone: response had no voice_id.") from exc
        return str(voice_id)


def _multipart(boundary: str, *, name: str, sample: bytes) -> bytes:
    """Encode the /voices/add form: a ``name`` field + one ``files`` audio part."""
    dash = f"--{boundary}\r\n".encode()
    parts = [
        dash,
        b'Content-Disposition: form-data; name="name"\r\n\r\n',
        name.encode("utf-8"),
        b"\r\n",
        dash,
        b'Content-Disposition: form-data; name="files"; filename="sample.mp3"\r\n',
        b"Content-Type: audio/mpeg\r\n\r\n",
        sample,
        b"\r\n",
        f"--{boundary}--\r\n".encode(),
    ]
    return b"".join(parts)
