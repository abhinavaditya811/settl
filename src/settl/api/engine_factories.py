"""Construction helpers for BoardState's engine collaborators (senders, drafter,
inbound classifier, Stripe minter) - split out of state.py to keep it under
CLAUDE.md's line cap. Pure functions of (log, env), no BoardState coupling.
"""

from __future__ import annotations

import os

from settl.api.oauth_google import google_oauth_enabled
from settl.audit import ExecutionLog
from settl.compliance.gate import ComplianceResult
from settl.sending import GmailSmtpSender, MockSender, Sender
from settl.sending.base import SendOutcome
from settl.sending.gmail_api_sender import GmailApiSender
from settl.schema.invoice import Channel, Invoice
from settl.voice.registry import DialLedger
from settl.voice.retell_sender import RetellVoiceSender
from settl.voice.sender import MockVoiceSender


class _PerTenantOrSharedSender:
    """Prefers each tenant's OWN connected Gmail (gmail.send scope) so a debtor
    sees mail genuinely from their vendor, not from one shared account; falls
    back to the shared SMTP sender for a tenant that hasn't connected Gmail
    yet. Checked per-invoice (not once at construction) since one Orchestrator
    instance handles every tenant's invoices."""

    def __init__(self, per_tenant: GmailApiSender, shared: Sender) -> None:
        self._per_tenant = per_tenant
        self._shared = shared

    def send(
        self,
        invoice: Invoice,
        message: str,
        compliance: ComplianceResult,
        channel: Channel | None = None,
    ) -> SendOutcome:
        sender = self._shared if self._per_tenant.token_for(invoice.tenant_id) is None else self._per_tenant
        return sender.send(invoice, message, compliance, channel)


class _ChannelRoutingSender:
    """Routes a VOICE send to the (mock) voice sender; every other channel keeps
    the written sender chosen by the flags below. Without this, a voice decision
    silently fell through to the email sender, which hard-codes emailing
    ``debtor_email`` regardless of channel. Voice stays mock-first, exactly like
    email did until a pilot signed - a live Retell branch would mirror the
    ``SETTL_LIVE_SEND`` + ``.configured`` check below when one is warranted."""

    def __init__(self, written: Sender, voice: Sender) -> None:
        self._default = written
        self._voice = voice

    def send(
        self,
        invoice: Invoice,
        message: str,
        compliance: ComplianceResult,
        channel: Channel | None = None,
    ) -> SendOutcome:
        sender = self._voice if channel is Channel.VOICE else self._default
        return sender.send(invoice, message, compliance, channel)


def make_sender(log: ExecutionLog, *, extra_gate: str | None = None) -> Sender:
    """The written sender below plus voice routing: a VOICE send goes to the voice
    sender (mock by default, live Retell when armed - see _make_voice_sender),
    everything else to the email/mock sender the live-send flags select."""
    return _ChannelRoutingSender(
        _make_written_sender(log, extra_gate=extra_gate), _make_voice_sender(log)
    )


def _make_voice_sender(log: ExecutionLog | None) -> Sender:
    """Mock voice sender ("would call") by default. A live Retell sender only when
    ALL of these hold, mirroring how email arms live sending:

      * SETTL_LIVE_SEND_VOICE=1 - its own deliberate opt-in, separate from email's
        SETTL_LIVE_SEND (arming email must not silently start dialing phones);
      * SETTL_TEST_CALL_NUMBER is set - every live dial redirects to the operator's
        own consented phone. Until per-debtor consent capture exists (VOICE_AGENT_SPEC
        §10), dialing a debtor's real number would fabricate the consent the gate is
        told about, so the redirect is REQUIRED, not optional;
      * the Retell env triad (RETELL_API_KEY / RETELL_FROM_NUMBER / RETELL_AGENT_ID)
        is configured.

    The sender gets its own DialLedger, so a double-click on the Call button is
    refused as withheld ("already dialed") instead of ringing twice."""
    test_number = os.environ.get("SETTL_TEST_CALL_NUMBER")
    if os.environ.get("SETTL_LIVE_SEND_VOICE") == "1" and test_number:
        live = RetellVoiceSender(
            log=log, force_recipient=test_number, ledger=DialLedger()
        )
        if live.configured:
            return live
    return MockVoiceSender(log=log)


def _make_written_sender(log: ExecutionLog, *, extra_gate: str | None = None) -> Sender:
    """Real Gmail sender, sending to each invoice's own debtor contact, when
    SETTL_LIVE_SEND is armed AND (no extra_gate, or that env var is separately
    set to "1"); mock otherwise. Prefers each tenant's own connected Gmail
    (GmailApiSender) over the shared SMTP account, for any tenant that has
    connected one - see _PerTenantOrSharedSender. No forced test-recipient
    redirect here (that was previously a hard requirement for arming live send
    at all, which also meant every real tenant's approvals got silently
    redirected to one fixed inbox instead of their actual debtor - see the
    demo-tenant sender below for where a forced redirect still legitimately
    belongs, on synthetic data). Every UNATTENDED path (batch, inbound
    auto-reply) passes its own extra_gate so going live there needs a second,
    deliberate opt-in - see state.py's docstring for why that split exists."""
    if extra_gate is not None and os.environ.get(extra_gate) != "1":
        return MockSender(log=log)
    if os.environ.get("SETTL_LIVE_SEND") == "1":
        shared = GmailSmtpSender(log=log)
        if shared.configured:
            if google_oauth_enabled():
                return _PerTenantOrSharedSender(GmailApiSender(log=log), shared)
            return shared
    return MockSender(log=log)


class _DemoGuardSender:
    """Wraps another sender so any invoice belonging to a demo/synthetic tenant
    always uses the mock path, regardless of what the wrapped sender would
    otherwise do. The public /demo page needs no login, so without this a
    visitor clicking "Approve & Send" there could trigger a real email the
    moment SETTL_LIVE_SEND is armed - this is a second, orthogonal gate to the
    per-trigger-source split above (batch/approval/inbound-reply), keyed on
    WHOSE data it is rather than HOW the send was triggered."""

    def __init__(self, real: Sender, mock: Sender, demo_tenant_ids: frozenset[str]) -> None:
        self._real = real
        self._mock = mock
        self._demo_tenant_ids = demo_tenant_ids

    def send(
        self,
        invoice: Invoice,
        message: str,
        compliance: ComplianceResult,
        channel: Channel | None = None,
    ) -> SendOutcome:
        sender = self._mock if invoice.tenant_id in self._demo_tenant_ids else self._real
        return sender.send(invoice, message, compliance, channel)


def make_guarded_sender(log: ExecutionLog, *, extra_gate: str | None = None) -> Sender:
    """make_sender + guard_demo_tenants in one - the combination state.py always
    wants (per-trigger gate AND the demo-tenant guard)."""
    return guard_demo_tenants(make_sender(log, extra_gate=extra_gate), log)


def guard_demo_tenants(sender: Sender, log: ExecutionLog) -> Sender:
    """Apply the demo-tenant guard above unless explicitly opted out with
    SETTL_LIVE_SEND_DEMO=1 (e.g. for a real showcase where demo data should
    also go out live) - off by default, matching every other live-send flag.

    Opting in uses its OWN from/to pair - SETTL_DEMO_SMTP_USER/_APP_PASSWORD/
    _TEST_RECIPIENT - if configured, separate from SETTL_SMTP_USER (the one
    used for real invoice testing, which now sends to each real invoice's own
    debtor contact - see make_sender). Without this, flipping
    SETTL_LIVE_SEND_DEMO on would flood the SAME inbox you're using to test
    your own invoices with ~25 synthetic seed sends. Falls back to the shared
    sender if the demo-specific pair isn't set."""
    if os.environ.get("SETTL_LIVE_SEND_DEMO") == "1":
        demo = _demo_sender(log)
        if demo is not None:
            # The demo-specific email sender still needs voice routing, or a
            # demo-tenant call would fall through to email (the pre-routing bug).
            return _ChannelRoutingSender(demo, _make_voice_sender(log))
        return sender
    from settl.api.identity import demo_tenant_ids

    # The demo fallback routes channels too, so a demo-tenant voice call still
    # shows as "would CALL" rather than a generic "would send" - both branches
    # are mocks (never the live Retell sender: a public /demo visitor must not
    # be able to burn call credit), so the never-live guarantee is unchanged.
    mock = _ChannelRoutingSender(MockSender(log=log), MockVoiceSender(log=log))
    return _DemoGuardSender(sender, mock, demo_tenant_ids())


def _demo_sender(log: ExecutionLog) -> Sender | None:
    user = os.environ.get("SETTL_DEMO_SMTP_USER")
    password = os.environ.get("SETTL_DEMO_SMTP_APP_PASSWORD")
    recipient = os.environ.get("SETTL_DEMO_TEST_RECIPIENT")
    if not (user and password and recipient):
        return None
    demo_sender = GmailSmtpSender(log=log, user=user, app_password=password, force_recipient=recipient)
    return demo_sender if demo_sender.configured else None


def is_live(sender: Sender) -> bool:
    """Whether ``sender`` ultimately delivers for real - unwraps the demo-tenant
    guard and the channel-routing wrapper above so state.py's
    live_send_enabled/inbound_reply_live_enabled can see through them to the
    underlying written sender (voice is always mock, so it never counts)."""
    real = getattr(sender, "_real", sender)
    real = getattr(real, "_default", real)
    return isinstance(real, (GmailSmtpSender, _PerTenantOrSharedSender))


def gemini_enabled() -> bool:
    """Real Gemini (chase drafting, reply drafting, inbound classification) is
    opt-in (SETTL_USE_GEMINI=1) *and* needs a key, so the default board run -
    and the test suite - stays offline and deterministic."""
    armed = os.environ.get("SETTL_USE_GEMINI") == "1"
    has_key = bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
    return armed and has_key


def make_drafter(log: ExecutionLog):
    """Real Gemini drafting (the visible AI) when a key is configured; the offline
    template otherwise. Drafting only affects the board batch - approvals re-gate a
    provided message and never re-draft."""
    from settl.agents.drafting import DraftingAgent
    from settl.agents.drafting.model import GeminiDraftModel

    if gemini_enabled():
        return DraftingAgent(log=log, model=GeminiDraftModel())
    return DraftingAgent(log=log)


def make_reply_drafter(log: ExecutionLog):
    """Real Gemini reply drafting when a key is configured; the offline template
    otherwise. Used for inbound auto-replies (BENIGN lane) - mirrors make_drafter."""
    from settl.agents.drafting import ReplyDraftingAgent
    from settl.agents.drafting.reply_model import GeminiReplyModel

    if gemini_enabled():
        return ReplyDraftingAgent(log=log, model=GeminiReplyModel())
    return ReplyDraftingAgent(log=log)


def groq_enabled() -> bool:
    """Groq (open-source Llama) inbound classification is opt-in (SETTL_USE_GROQ=1)
    *and* needs a key - same off-by-default posture as Gemini so the test suite and
    a plain run stay offline."""
    return os.environ.get("SETTL_USE_GROQ") == "1" and bool(os.environ.get("GROQ_API_KEY"))


def make_inbound_agent(log: ExecutionLog):
    """Classifier for inbound replies (lane routing - dispute/opt-out/payment-plan/
    benign). Preference order: Groq (higher free-tier quota - Gemini's kept 429-ing
    and silently dropping replies to the weak regex backstop) → Gemini → the regex
    backstop. Only changes WHICH LANE a reply routes to - the compliance gate remains
    the sole send authority regardless of which classifier decided it."""
    from settl.agents.inbound import (
        GeminiInboundClassifierModel,
        GroqInboundClassifierModel,
        InboundAgent,
    )

    if groq_enabled():
        return InboundAgent(log=log, model=GroqInboundClassifierModel())
    if gemini_enabled():
        return InboundAgent(log=log, model=GeminiInboundClassifierModel())
    return InboundAgent(log=log)


def make_minter():
    """A Stripe link minter when armed (SETTL_USE_STRIPE=1 + a key), else None. Off
    by default so the board never creates Stripe objects just because a key exists."""
    from settl.payments import StripeLinkMinter, stripe_enabled

    return StripeLinkMinter() if stripe_enabled() else None
