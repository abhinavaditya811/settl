"""The voice channel - a phone call is a "send" on ``Channel.VOICE``.

Voice reuses the existing pipeline unchanged (strategy → draft → compliance gate →
send → reconcile); nothing here is a new authority to trust. This package only adds:

  * ``script.py``      - build the spoken call script (AI disclosure + reminder + link close)
  * ``consent.py``     - bridge a tenant's ``audio`` config into the gate's voice inputs
  * ``sender.py``      - ``MockVoiceSender`` (offline "would call"), behind the ``Sender`` seam
  * ``provider.py``    - the TTS/clone provider seam + ``MockVoiceProvider`` (Phase 2)
  * ``elevenlabs_provider.py`` - the live ElevenLabs backend (TTS + instant clone)
  * ``retell_sender.py`` - the live telephony sender (Retell, Phase 3, behind env config)
  * ``registry.py``    - per-debtor voice-safety records: consent, do-not-call, dial ledger
  * ``artifact.py``    - pull the ended call (transcript/outcome) back into the audit log
  * ``webhook.py``     - the push twin: verified Retell end-of-call events → artifacts
  * ``followup.py``    - the companion SMS leg that carries the payment link
  * ``recording.py``   - per-state recording-consent disclosure (conservative)
  * ``timezones.py``   - debtor-local clock for the call-window rule
  * ``render.py``      - render a cleared ``CallScript`` to a ``VoiceClip`` via a provider
  * ``onboarding.py``  - the opt-in voice-clone flow (consent-gated)

The voice compliance rules live with every other rule in ``settl.compliance`` - the gate
stays the single send authority. See VOICE_AGENT_SPEC.md.
"""

from settl.voice.artifact import (
    ArtifactFetchFailed,
    CallArtifact,
    classify_outcome,
    pull_call_artifact,
    record_artifact,
)
from settl.voice.consent import voice_context_for
from settl.voice.elevenlabs_provider import ElevenLabsProvider
from settl.voice.followup import send_sms_followup
from settl.voice.onboarding import ConsentRequired, onboard_clone
from settl.voice.recording import needs_recording_announcement, recording_disclosure
from settl.voice.registry import (
    ConsentStore,
    DialLedger,
    DoNotCallRegistry,
    voice_context_from_records,
)
from settl.voice.timezones import debtor_local_time, zone_for_state
from settl.voice.webhook import (
    handle_retell_event,
    ingest_retell_webhook,
    verify_signature,
)
from settl.voice.provider import (
    CloneNotSupported,
    MockVoiceProvider,
    VoiceClip,
    VoiceProvider,
    VoiceProviderError,
)
from settl.voice.render import render_script
from settl.voice.retell_sender import (
    AlreadyDialed,
    CallFailed,
    MissingTelephonyConfig,
    RetellVoiceSender,
)
from settl.voice.script import CallScript, build_call_script
from settl.voice.sender import MockVoiceSender

__all__ = [
    "CallScript",
    "build_call_script",
    "voice_context_for",
    "MockVoiceSender",
    "RetellVoiceSender",
    "MissingTelephonyConfig",
    "CallFailed",
    "AlreadyDialed",
    "ConsentStore",
    "DoNotCallRegistry",
    "DialLedger",
    "voice_context_from_records",
    "CallArtifact",
    "classify_outcome",
    "pull_call_artifact",
    "record_artifact",
    "ArtifactFetchFailed",
    "send_sms_followup",
    "handle_retell_event",
    "ingest_retell_webhook",
    "verify_signature",
    "recording_disclosure",
    "needs_recording_announcement",
    "debtor_local_time",
    "zone_for_state",
    "VoiceProvider",
    "VoiceClip",
    "MockVoiceProvider",
    "ElevenLabsProvider",
    "VoiceProviderError",
    "CloneNotSupported",
    "render_script",
    "onboard_clone",
    "ConsentRequired",
]
