"""Sending — mocked in task 1 (logs 'would send'). Real email/SMS/Stripe land
only once a pilot is signed (DESIGN §5)."""

from settl.sending.mock_sender import MockSender, SendOutcome

__all__ = ["MockSender", "SendOutcome"]
