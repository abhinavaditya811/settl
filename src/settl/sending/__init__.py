"""Sending — the gate-cleared delivery seam.

``MockSender`` (default, offline) logs "would send …"; ``GmailSmtpSender`` is the
contingent real-email path for a self-test. Both inherit the compliance refusal
from ``GatedSender`` (DESIGN §5)."""

from settl.sending.base import GatedSender, SendOutcome, Sender
from settl.sending.email_sender import GmailSmtpSender, MissingCredentials
from settl.sending.mock_sender import MockSender

__all__ = [
    "GatedSender",
    "GmailSmtpSender",
    "MissingCredentials",
    "MockSender",
    "SendOutcome",
    "Sender",
]
