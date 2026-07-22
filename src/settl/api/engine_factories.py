"""Construction helpers for BoardState's engine collaborators (senders, drafter,
inbound classifier, Stripe minter) - split out of state.py to keep it under
CLAUDE.md's line cap. Pure functions of (log, env), no BoardState coupling.
"""

from __future__ import annotations

import os

from settl.audit import ExecutionLog
from settl.compliance.gate import ComplianceResult
from settl.schema.invoice import Channel, Invoice
from settl.sending import GmailSmtpSender, MockSender, Sender
from settl.sending.base import SendOutcome


def make_sender(log: ExecutionLog, *, extra_gate: str | None = None) -> Sender:
    """Real Gmail sender (redirected to SETTL_TEST_RECIPIENT) when SETTL_LIVE_SEND
    is armed AND (no extra_gate, or that env var is separately set to "1");
    mock otherwise. The approval path is gated by SETTL_LIVE_SEND alone; every
    UNATTENDED path (batch, inbound auto-reply) passes its own extra_gate so
    going live there needs a second, deliberate opt-in - see state.py's
    docstring for why that split exists."""
    if extra_gate is not None and os.environ.get(extra_gate) != "1":
        return MockSender(log=log)
    recipient = os.environ.get("SETTL_TEST_RECIPIENT")
    live = os.environ.get("SETTL_LIVE_SEND") == "1"
    if live and recipient:
        sender = GmailSmtpSender(log=log, force_recipient=recipient)
        if sender.configured:
            return sender
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
    _TEST_RECIPIENT - if configured, separate from SETTL_SMTP_USER/
    SETTL_TEST_RECIPIENT (the ones used for real invoice testing). Without
    this, flipping SETTL_LIVE_SEND_DEMO on would flood the SAME inbox you're
    using to test your own invoices with ~25 synthetic seed sends. Falls back
    to the shared sender if the demo-specific pair isn't set."""
    if os.environ.get("SETTL_LIVE_SEND_DEMO") == "1":
        return _demo_sender(log) or sender
    from settl.api.identity import demo_tenant_ids

    return _DemoGuardSender(sender, MockSender(log=log), demo_tenant_ids())


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
    guard above so state.py's live_send_enabled/inbound_reply_live_enabled can
    see through it to the underlying sender."""
    return isinstance(getattr(sender, "_real", sender), GmailSmtpSender)


def gemini_enabled() -> bool:
    """Real Gemini (drafting + inbound classification) is opt-in (SETTL_USE_GEMINI=1)
    *and* needs a key, so the default board run - and the test suite - stays
    offline and deterministic."""
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


def make_inbound_agent(log: ExecutionLog):
    """Real Gemini classification for inbound replies (lane routing - dispute/
    opt-out/payment-plan/benign) when a key is configured; the regex backstop
    otherwise. Only changes WHICH LANE a reply routes to - the compliance gate
    remains the sole send authority regardless of which classifier decided it."""
    from settl.agents.inbound import GeminiInboundClassifierModel, InboundAgent

    if gemini_enabled():
        return InboundAgent(log=log, model=GeminiInboundClassifierModel())
    return InboundAgent(log=log)


def make_minter():
    """A Stripe link minter when armed (SETTL_USE_STRIPE=1 + a key), else None. Off
    by default so the board never creates Stripe objects just because a key exists."""
    from settl.payments import StripeLinkMinter, stripe_enabled

    return StripeLinkMinter() if stripe_enabled() else None
