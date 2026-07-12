"""🔌 Live voice sender over Retell AI - places a REAL phone call (Phase 3).

The voice twin of ``GmailSmtpSender``: it inherits the compliance refusal and the
payment-link hard-fail from ``GatedSender`` (a call the gate escalated can never be
dialed), reads all credentials from the environment, and is NOT wired into the default
pipeline - the offline default stays ``MockVoiceSender``, exactly as email stays mocked.

    RETELL_API_KEY      your Retell secret key
    RETELL_FROM_NUMBER  the Retell-managed number we dial from (E.164, e.g. +1415...)
    RETELL_AGENT_ID     the Retell agent that speaks (built in their dashboard; its
                        prompt must deliver {{script}} verbatim and stay in bounds)

Two hard lines this module holds (VOICE_AGENT_SPEC §3a):

  * **The spoken script is passed as a dynamic variable, already gate-cleared.** The
    Retell agent's job is delivery + simple replies, not authorship - the words were
    written by drafting and cleared by the gate before this class is ever reached.
  * **The payment link never goes to the voice provider.** Only the spoken leg is
    sent; the companion SMS (which carries the real link) is a separate leg, logged
    here and delivered by the SMS channel - a URL is texted, never spoken (§3a.10).

Endpoint verified against the current Retell API reference
(POST https://api.retellai.com/v2/create-phone-call, Bearer auth) - not memory.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

from settl.audit.execution_log import ExecutionLog
from settl.config import load_dotenv
from settl.schema.invoice import Channel, Invoice
from settl.sending.base import GatedSender
from settl.voice.registry import DialLedger

_API_URL = "https://api.retellai.com/v2/create-phone-call"
_TIMEOUT_SECS = 30


class MissingTelephonyConfig(RuntimeError):
    """Raised when the Retell env vars needed to place a call are not set."""


class CallFailed(RuntimeError):
    """Retell refused or failed to register the outbound call."""


class AlreadyDialed(CallFailed):
    """The dial ledger shows this invoice was already called today - never
    double-dial the same invoice for the same touch (VOICE_AGENT_SPEC §3b.17)."""


def _request(url: str, *, headers: dict[str, str], data: bytes) -> tuple[int, bytes]:
    """One POST → (status, body); 4xx/5xx come back as a status, offline raises."""
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT_SECS) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()
    except urllib.error.URLError as exc:
        raise CallFailed(f"Retell unreachable: {exc.reason}") from exc


class RetellVoiceSender(GatedSender):
    """Dials a gate-cleared call script to the debtor via a Retell agent."""

    agent_name = "voice_sender"

    def __init__(
        self,
        log: ExecutionLog | None = None,
        *,
        default_payment_link: str | None = None,
        api_key: str | None = None,
        from_number: str | None = None,
        agent_id: str | None = None,
        force_recipient: str | None = None,
        ledger: DialLedger | None = None,
        business_name: str = "",
        escalation_number: str | None = None,
        business_facts: str = "",
    ) -> None:
        super().__init__(log=log, default_payment_link=default_payment_link)
        # Idempotency (spec §3b.17): when a ledger is supplied, an invoice already
        # dialed today raises AlreadyDialed instead of ringing the debtor again.
        self._ledger = ledger
        # Tenant context injected per call as dynamic variables (one sender per
        # tenant per run, like every sender): identity.business_name, and the audio
        # slice's escalation_number ({{transfer_number}} for the Call Transfer tool)
        # + business_facts (per-tenant FAQ grounding for the shared agent).
        self._business_name = business_name
        self._escalation_number = escalation_number
        self._business_facts = business_facts
        load_dotenv()  # surface .env-provided creds, same as Gemini/ElevenLabs
        self._key = api_key or os.environ.get("RETELL_API_KEY")
        self._from = from_number or os.environ.get("RETELL_FROM_NUMBER")
        self._agent_id = agent_id or os.environ.get("RETELL_AGENT_ID")
        # Safety belt for self-tests: force every dial to a known number (yours /
        # Abhinav's) so a synthetic debtor's phone can never be called by accident.
        self._force_recipient = force_recipient or os.environ.get("SETTL_TEST_CALL_NUMBER")

    @property
    def configured(self) -> bool:
        return bool(self._key and self._from and self._agent_id)

    def _dynamic_variables(self, invoice: Invoice, spoken: str) -> dict[str, str]:
        """Per-call context for the agent (Retell wants string values). The verbatim
        opener plus the invoice FACTS, so the agent answers "which invoice? how
        much?" accurately instead of improvising. The payment link is deliberately
        absent - a URL is texted, never given to the voice provider (§3a.10)."""
        variables = {
            "script": spoken,
            "business_name": self._business_name,
            "invoice_id": invoice.invoice_id,
            "amount_due": f"{invoice.amount_due} {invoice.currency}",
            "days_overdue": str(invoice.days_overdue),
            "debtor_name": invoice.debtor_name,
        }
        # Optional legs: only included when configured, so a dashboard tool bound to
        # {{transfer_number}} simply never fires for tenants without a handoff line.
        if self._escalation_number:
            variables["transfer_number"] = self._escalation_number
        if self._business_facts:
            variables["business_facts"] = self._business_facts
        return variables

    def _deliver(self, invoice: Invoice, message: str, channel: Channel | None) -> str:
        if not self.configured:
            raise MissingTelephonyConfig(
                "Set RETELL_API_KEY, RETELL_FROM_NUMBER and RETELL_AGENT_ID to place calls."
            )
        to = self._force_recipient or invoice.contact_for(Channel.VOICE)
        if not to:
            raise CallFailed(f"{invoice.invoice_id}: no phone number to dial.")
        if self._ledger is not None and self._ledger.already_dialed(invoice):
            raise AlreadyDialed(
                f"{invoice.invoice_id}: already dialed today - refusing to double-dial."
            )

        # message = CallScript.full after gate + link resolution. Split the legs: the
        # spoken script goes to the agent; the SMS line (with the REAL link) does NOT.
        spoken, _, sms = message.partition("\n")

        body = json.dumps(
            {
                "from_number": self._from,
                "to_number": to,
                "override_agent_id": self._agent_id,
                "retell_llm_dynamic_variables": self._dynamic_variables(invoice, spoken),
                "metadata": {"invoice_id": invoice.invoice_id, "tenant_id": invoice.tenant_id},
            }
        ).encode("utf-8")
        status, payload = _request(
            _API_URL,
            headers={
                "Authorization": f"Bearer {self._key}",
                "Content-Type": "application/json",
            },
            data=body,
        )
        if status not in (200, 201):
            raise CallFailed(f"Retell rejected the call ({status}): "
                             f"{payload.decode('utf-8', 'replace')[:200]}")
        call_id = json.loads(payload.decode("utf-8")).get("call_id", "?")
        if self._ledger is not None:
            self._ledger.mark(invoice)  # Retell accepted → this touch is spent

        original = invoice.contact_for(Channel.VOICE)
        redirected = (
            f" (redirected from {original})"
            if self._force_recipient and self._force_recipient != original
            else ""
        )
        detail = f"CALLED {to}{redirected} via Retell (call_id={call_id})"
        if sms:
            # The link leg stays on the SMS channel - not spoken, not sent to Retell.
            detail += f" | SMS leg queued for the sms channel :: {sms}"
        return detail
