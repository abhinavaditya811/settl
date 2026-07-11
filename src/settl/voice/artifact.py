"""🔌 CallArtifact - what actually happened on a call, pulled back into the audit log.

VOICE_AGENT_SPEC §4: every call leaves a durable artifact (transcript, disclosure,
recording ref, consent citation, outcome). Placing the call is half the loop; this
module closes it by fetching the ended call from Retell (GET /v2/get-call/{call_id},
verified against current docs) and mapping it into our canonical ``CallArtifact``.

The outcome label is DETERMINISTIC - the same conservative pattern style as the gate,
never a model call. A transcript is debtor-controlled text, so it is data only: we
scan it for signals (dispute / opt-out / pay-intent), we never act on it as
instructions. Anything unclear labels ``escalated`` - a human looks, nothing is
guessed. An ``opted_out`` outcome is wired straight into the do-not-call registry by
``pull_call_artifact`` so "stop calling" takes effect the moment we learn of it.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass

from settl.audit.execution_log import ExecutionLog
from settl.compliance import patterns as P
from settl.config import load_dotenv
from settl.voice.registry import DoNotCallRegistry

_GET_CALL_URL = "https://api.retellai.com/v2/get-call/{call_id}"
_TIMEOUT_SECS = 30

# Retell disconnection reasons that mean the debtor was never actually reached.
_NO_ANSWER_REASONS = frozenset({"dial_no_answer", "dial_busy", "dial_failed"})
_VOICEMAIL_REASONS = frozenset({"voicemail_reached", "machine_detected"})


class ArtifactFetchFailed(RuntimeError):
    """Could not retrieve the call from Retell (network, auth, unknown call id)."""


@dataclass(frozen=True)
class CallArtifact:
    """The canonical per-call audit record (spec §4). Flat and serializable, like a
    ``LogEntry`` - it doubles as compliance evidence and the dashboard's call view."""

    call_id: str
    invoice_id: str
    tenant_id: str
    dialed_at: str  # ISO; from Retell's start timestamp when present
    called_number: str
    agent_voice_id: str
    voice_mode: str  # "default" | "cloned"
    disclosure_text: str  # the AI disclosure the script opened with
    transcript: str
    recording_ref: str | None  # provider recording URL (encrypted storage later)
    outcome: str  # pay_intent | dispute | no_answer | voicemail | escalated | opted_out
    consent_citation: str  # which consent authorized the dial (granted_at/method)
    duration_secs: float


def classify_outcome(transcript: str, *, call_status: str = "", disconnection_reason: str = "") -> str:
    """Deterministic outcome label, most-severe-first. Debtor text is scanned with the
    same conservative patterns the gate uses; no signal at all → ``escalated`` (a
    human reviews the call rather than the agent guessing it went fine)."""
    if disconnection_reason in _VOICEMAIL_REASONS:
        return "voicemail"
    if disconnection_reason in _NO_ANSWER_REASONS or call_status in ("not_connected", "error"):
        return "no_answer"
    if not transcript.strip():
        return "no_answer"
    if P.matches(transcript, P.INBOUND_OPT_OUT_RE):
        return "opted_out"  # honored immediately; registry updated by the caller
    if P.matches(transcript, P.INBOUND_DISPUTE_RE):
        return "dispute"
    if P.matches(transcript, P.INBOUND_PAYMENT_PLAN_RE):
        return "escalated"  # plan requests are never auto-negotiated
    if P.matches(transcript, P.PAY_INTENT_RE):
        return "pay_intent"
    return "escalated"


def _get(url: str, *, headers: dict[str, str]) -> tuple[int, bytes]:
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT_SECS) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()
    except urllib.error.URLError as exc:
        raise ArtifactFetchFailed(f"Retell unreachable: {exc.reason}") from exc


def fetch_call(call_id: str, *, api_key: str | None = None) -> dict:
    """GET the (ended) call payload from Retell."""
    load_dotenv()
    key = api_key or os.environ.get("RETELL_API_KEY")
    if not key:
        raise ArtifactFetchFailed("Set RETELL_API_KEY to fetch call artifacts.")
    status, payload = _get(
        _GET_CALL_URL.format(call_id=call_id),
        headers={"Authorization": f"Bearer {key}"},
    )
    if status != 200:
        raise ArtifactFetchFailed(
            f"Retell get-call failed ({status}): {payload.decode('utf-8', 'replace')[:200]}"
        )
    return json.loads(payload.decode("utf-8"))


def artifact_from_payload(
    payload: dict,
    *,
    invoice_id: str,
    tenant_id: str,
    voice_mode: str = "default",
    agent_voice_id: str = "default",
    disclosure_text: str = "",
    consent_citation: str = "",
) -> CallArtifact:
    """Pure mapper: Retell's call payload + our send-side context → CallArtifact.
    The send-side fields (mode, disclosure, consent citation) are OURS - they come
    from the pipeline that placed the call, never trusted from the provider."""
    transcript = payload.get("transcript") or ""
    start_ms = payload.get("start_timestamp")
    duration_ms = payload.get("duration_ms") or 0
    return CallArtifact(
        call_id=payload.get("call_id", "?"),
        invoice_id=invoice_id,
        tenant_id=tenant_id,
        dialed_at=(str(start_ms) if start_ms is not None else ""),
        called_number=payload.get("to_number", ""),
        agent_voice_id=agent_voice_id,
        voice_mode=voice_mode,
        disclosure_text=disclosure_text,
        transcript=transcript,
        recording_ref=payload.get("recording_url"),
        outcome=classify_outcome(
            transcript,
            call_status=payload.get("call_status", ""),
            disconnection_reason=payload.get("disconnection_reason", "") or "",
        ),
        consent_citation=consent_citation,
        duration_secs=round(duration_ms / 1000, 1),
    )


def pull_call_artifact(
    call_id: str,
    *,
    invoice_id: str,
    tenant_id: str,
    called_number: str = "",
    log: ExecutionLog | None = None,
    do_not_call: DoNotCallRegistry | None = None,
    api_key: str | None = None,
    **send_context,
) -> CallArtifact:
    """Fetch → map → record: the one call that closes the loop after a dial.

    Writes the artifact to the execution log (agent ``voice_artifact``) and, when the
    outcome is ``opted_out``, registers the number on the do-not-call registry at
    once - the gate then refuses every future dial to that debtor."""
    artifact = artifact_from_payload(
        fetch_call(call_id, api_key=api_key),
        invoice_id=invoice_id, tenant_id=tenant_id, **send_context,
    )
    number = artifact.called_number or called_number
    if artifact.outcome == "opted_out" and do_not_call is not None and number:
        do_not_call.register(tenant_id, number)
    if log is not None:
        details = asdict(artifact)
        details.pop("invoice_id")  # already the entry's own key
        log.record(
            invoice_id=invoice_id,
            agent="voice_artifact",
            decision=artifact.outcome,
            reasoning=(
                f"Call {artifact.call_id} ended ({artifact.duration_secs}s) - "
                f"outcome: {artifact.outcome}."
            ),
            **details,
        )
    return artifact
