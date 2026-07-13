"""Voice Phase 2 - TTS provider seam, render, and clone onboarding. All offline.

Everything here runs on ``MockVoiceProvider`` (deterministic, no audio, no network, no
binaries), so it's hermetic in CI. The one guarantee it proves hardest: **no clone
without active consent** - onboarding refuses to touch the provider otherwise.
"""

import pytest

from settl.tenancy.config import AudioMode, ConsentRecord
from settl.voice import (
    CloneNotSupported,
    ConsentRequired,
    MockVoiceProvider,
    build_call_script,
    onboard_clone,
    render_script,
)
from settl.voice.provider import VoiceClip

PLACEHOLDER = "{{payment_link}}"


def _script():
    return build_call_script(
        business_name="Acme",
        reminder=f"Invoice INV-1 is 12 days past due. Pay: {PLACEHOLDER}",
    )


# --- provider seam ------------------------------------------------------------


def test_mock_provider_synthesizes_a_clip():
    clip = MockVoiceProvider().synthesize("hello", voice_id="default")
    assert isinstance(clip, VoiceClip)
    assert clip.voice_id == "default" and clip.text == "hello"
    assert clip.is_audio is False  # mock is a text stand-in, not real audio


def test_clip_saves_to_disk(tmp_path):
    clip = MockVoiceProvider().synthesize("hi there", voice_id="default")
    p = clip.save(tmp_path / "sub" / "clip.txt")  # parent dir auto-created
    assert p.exists() and p.read_bytes() == b"hi there"


def test_mock_clone_is_deterministic():
    prov = MockVoiceProvider()
    a = prov.clone(b"sample-audio", name="owner")
    b = prov.clone(b"sample-audio", name="owner")
    assert a == b and a.startswith("cloned_")


# --- render (speaks the spoken leg only) --------------------------------------


def test_render_speaks_only_the_spoken_leg():
    script = _script()
    clip = render_script(script, provider=MockVoiceProvider(), voice_id="default")
    # The spoken leg is rendered; the SMS link line and the placeholder are NOT spoken.
    assert clip.text == script.spoken
    assert PLACEHOLDER not in clip.text
    assert "secure link to pay" in clip.text


def test_render_can_write_the_clip(tmp_path):
    out = tmp_path / "call.txt"
    render_script(_script(), provider=MockVoiceProvider(), voice_id="default",
                  out_path=out)
    assert out.exists()


# --- clone onboarding (consent-gated) -----------------------------------------


def _clone_consent(revoked_at=None):
    return ConsentRecord(
        kind="clone", granted_by="owner", granted_at="2026-07-01",
        method="checkbox", evidence_ref="sample.wav", revoked_at=revoked_at,
    )


def test_onboarding_clones_with_active_consent():
    audio = onboard_clone(
        b"owner-voice-sample", _clone_consent(),
        provider=MockVoiceProvider(), default_voice_id="default",
    )
    assert audio.mode is AudioMode.CLONED
    assert audio.enabled is True
    assert audio.voice_id and audio.voice_id.startswith("cloned_")
    assert audio.default_voice_id == "default"  # fallback preserved
    assert audio.active_voice_id == audio.voice_id  # clone is used (consent active)


def test_onboarding_refuses_without_consent_and_never_calls_provider():
    class ExplodingProvider(MockVoiceProvider):
        def clone(self, sample, *, name):  # pragma: no cover - must not run
            raise AssertionError("clone() must not be called without active consent")

    with pytest.raises(ConsentRequired):
        onboard_clone(b"x", _clone_consent(revoked_at="2026-07-09"),
                      provider=ExplodingProvider())


def test_onboarding_rejects_a_non_clone_consent():
    call_consent = ConsentRecord(kind="call", granted_by="owner", granted_at="2026-07-01")
    with pytest.raises(ConsentRequired):
        onboard_clone(b"x", call_consent, provider=MockVoiceProvider())


def test_cloned_config_reverts_to_default_when_consent_revoked():
    audio = onboard_clone(b"s", _clone_consent(), provider=MockVoiceProvider())
    from dataclasses import replace

    revoked = replace(audio, clone_consent=_clone_consent(revoked_at="2026-07-09"))
    assert revoked.active_voice_id == "default"  # never speak a clone after revocation


# --- a backend that can't clone surfaces cleanly ------------------------------


def test_clone_not_supported_is_a_provider_error():
    assert issubclass(CloneNotSupported, Exception)

    class StockOnly(MockVoiceProvider):
        def clone(self, sample, *, name):
            raise CloneNotSupported("stock voices only")

    with pytest.raises(CloneNotSupported):
        onboard_clone(b"s", _clone_consent(), provider=StockOnly())


# --- ElevenLabs backend (HTTP monkeypatched - hermetic, no key, no network) ----


def _fake_request(responses):
    """A stand-in for elevenlabs_provider._request that records each call and
    replays canned (status, body) responses - the smtplib-FakeSMTP trick."""
    calls = []

    def fake(url, *, headers, data, method="POST"):
        calls.append({"url": url, "headers": headers, "data": data})
        return responses.pop(0)

    return fake, calls


@pytest.fixture()
def el(monkeypatch):
    """An ElevenLabsProvider with a key injected and the network stubbed out."""
    from settl.voice import elevenlabs_provider as mod

    def make(responses):
        fake, calls = _fake_request(responses)
        monkeypatch.setattr(mod, "_request", fake)
        return mod.ElevenLabsProvider(api_key="k-test"), calls

    return make


def test_elevenlabs_requires_a_key(monkeypatch):
    from settl.voice.elevenlabs_provider import ElevenLabsProvider
    from settl.voice.provider import VoiceProviderError

    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    monkeypatch.setattr("settl.voice.elevenlabs_provider.load_dotenv", lambda: {})
    with pytest.raises(VoiceProviderError):
        ElevenLabsProvider()


def test_elevenlabs_synthesize_returns_mp3_and_maps_default_voice(el):
    prov, calls = el([(200, b"\xff\xf3MP3BYTES")])
    clip = prov.synthesize("hello there", voice_id="default")
    assert clip.is_audio and clip.mime == "audio/mpeg"
    assert clip.audio == b"\xff\xf3MP3BYTES"
    # "default" maps to a premade stock id in the URL; key travels in the header.
    assert "EXAVITQu4vr4xnSDxMaL" in calls[0]["url"]
    assert calls[0]["headers"]["xi-api-key"] == "k-test"


def test_elevenlabs_synthesize_error_is_a_provider_error(el):
    from settl.voice.provider import VoiceProviderError

    prov, _ = el([(401, b'{"detail": {"message": "invalid api key"}}')])
    with pytest.raises(VoiceProviderError, match="invalid api key"):
        prov.synthesize("hi", voice_id="default")


def test_elevenlabs_clone_returns_the_new_voice_id(el):
    prov, calls = el([(200, b'{"voice_id": "v_abc123", "requires_verification": false}')])
    vid = prov.clone(b"owner-sample-bytes", name="owner")
    assert vid == "v_abc123"
    assert calls[0]["url"].endswith("/voices/add")
    assert b"owner-sample-bytes" in calls[0]["data"]  # sample travels in the multipart


def test_elevenlabs_free_tier_clone_maps_to_clone_not_supported(el):
    # ElevenLabs refuses IVC below the Starter plan → surfaced as CloneNotSupported,
    # not a generic failure, so onboarding can tell "wrong plan" from "broken".
    prov, _ = el([(403, b'{"detail": {"message": "voice cloning requires Starter"}}')])
    with pytest.raises(CloneNotSupported, match="Starter"):
        prov.clone(b"s", name="owner")


def test_onboarding_works_end_to_end_on_the_elevenlabs_seam(el):
    prov, _ = el([(200, b'{"voice_id": "v_cloned9"}')])
    audio = onboard_clone(b"owner-voice", _clone_consent(), provider=prov)
    assert audio.mode is AudioMode.CLONED
    assert audio.voice_id == "v_cloned9"
    assert audio.provider == "elevenlabs"
    assert audio.active_voice_id == "v_cloned9"
