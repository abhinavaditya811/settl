"""Construction helpers for BoardState's engine collaborators (senders, drafter,
inbound classifier, Stripe minter) - split out of state.py to keep it under
CLAUDE.md's line cap. Pure functions of (log, env), no BoardState coupling.
"""

from __future__ import annotations

import os

from settl.audit import ExecutionLog
from settl.sending import GmailSmtpSender, MockSender, Sender


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
