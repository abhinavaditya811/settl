"""🔌 Retell webhook - call artifacts PUSHED to us the moment a call ends.

The event-driven twin of ``artifact.fetch_call`` (which pulls): Retell POSTs
``{event, call}`` at each lifecycle step, and this module turns the terminal events
into the same ``CallArtifact`` + do-not-call handling the pull path uses - one
mapper, two transports. Like the Stripe webhook (payments/webhook.py), this layer is
**detection only**: it verifies, maps, and records; it never sends, gates, or decides.

Security posture (a webhook is an OPEN door to the internet):

  * **Signature required.** ``x-retell-signature`` has the form ``v=<ts>,d=<digest>``
    where digest = HMAC-SHA256(api_key, raw_body + ts) - verified against the Retell
    Python SDK's own implementation, compared with ``hmac.compare_digest``, and
    replay-limited to a 5-minute window. No valid signature → the event is ignored.
  * **Payload is data, never instructions.** Transcripts are debtor-controlled text;
    they only ever flow through the deterministic ``classify_outcome`` patterns.
  * **Correlation via OUR metadata.** invoice_id/tenant_id come from the metadata we
    set at dial time - an event without them is acknowledged and dropped, never guessed.
"""

from __future__ import annotations

import hmac
import json
import os
import re
import time as _time
from hashlib import sha256

from settl.audit.execution_log import ExecutionLog
from settl.config import load_dotenv
from settl.voice.artifact import CallArtifact, artifact_from_payload, record_artifact
from settl.voice.registry import DoNotCallRegistry

# Signature format per the Retell SDK: v=<unix_ts_ms>,d=<hmac_hex>.
_SIGNATURE_RE = re.compile(r"v=(\d+),d=([0-9a-f]+)", re.IGNORECASE)
REPLAY_WINDOW_SECS = 300  # 5 minutes, matching the SDK default

# The lifecycle events that mean "the call is over - record it". call_analyzed
# arrives after call_ended with the same call object plus analysis; recording both
# is harmless (the log is append-only and each names its event).
TERMINAL_EVENTS = frozenset({"call_ended", "call_analyzed"})


def verify_signature(raw_body: bytes, signature: str, api_key: str) -> bool:
    """Constant-time verification of ``x-retell-signature`` over the raw body."""
    match = _SIGNATURE_RE.fullmatch(signature.strip())
    if not match:
        return False
    ts, digest = match.groups()
    if abs(_time.time() * 1000 - int(ts)) > REPLAY_WINDOW_SECS * 1000:
        return False  # too old/new - replay protection
    expected = hmac.new(
        api_key.encode("utf-8"),
        raw_body + ts.encode("utf-8"),
        sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, digest.lower())


def ingest_retell_webhook(
    raw_body: bytes,
    signature: str | None,
    *,
    log: ExecutionLog | None = None,
    do_not_call: DoNotCallRegistry | None = None,
    api_key: str | None = None,
) -> CallArtifact | None:
    """The one call an API route makes: verify → parse → handle. Fail-safe like the
    Stripe ingest - no key configured, a missing/bad signature, or unparseable JSON
    returns None (the route still 2xx's; Retell retries only on non-2xx)."""
    load_dotenv()
    key = api_key or os.environ.get("RETELL_API_KEY")
    if not key or not signature or not verify_signature(raw_body, signature, key):
        return None
    try:
        event = json.loads(raw_body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return None
    return handle_retell_event(event, log=log, do_not_call=do_not_call)


def handle_retell_event(
    event: dict,
    *,
    log: ExecutionLog | None = None,
    do_not_call: DoNotCallRegistry | None = None,
) -> CallArtifact | None:
    """One verified webhook event → (maybe) a recorded CallArtifact.

    Returns the artifact for a terminal event with our correlation metadata; None
    for lifecycle noise (call_started, transcript_updated, missing metadata). The
    caller has ALREADY verified the signature - this function trusts its input
    exactly as far as the deterministic mapper does (i.e. not at all: transcripts
    only meet ``classify_outcome`` patterns, never an agent)."""
    if event.get("event") not in TERMINAL_EVENTS:
        return None
    call = event.get("call") or {}
    metadata = call.get("metadata") or {}
    invoice_id = metadata.get("invoice_id")
    tenant_id = metadata.get("tenant_id")
    if not invoice_id or not tenant_id:
        return None  # not a call we placed (or metadata stripped) - never guess

    artifact = artifact_from_payload(call, invoice_id=invoice_id, tenant_id=tenant_id)
    record_artifact(
        artifact,
        log=log,
        do_not_call=do_not_call,
        source=f"webhook:{event['event']}",
    )
    return artifact
