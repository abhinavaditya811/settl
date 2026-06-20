"""Mock sender - logs exactly what it *would* send, contacts no real channel.

The default sender for every offline run and test. It inherits the compliance
refusal from ``GatedSender`` (it will not send on an ESCALATE result), so the only
thing it adds is a "would send …" delivery line. Real senders (email/SMS) swap in
behind the same ``Sender`` seam once a pilot is signed (DESIGN §5).
"""

from __future__ import annotations

from settl.sending.base import GatedSender, SendOutcome, Sender
from settl.schema.invoice import Channel, Invoice

__all__ = ["MockSender", "SendOutcome", "Sender"]


class MockSender(GatedSender):
    def _deliver(self, invoice: Invoice, message: str, channel: Channel | None) -> str:
        via = channel.value if channel else "email"
        return f"would send: to={invoice.debtor_contact} via={via} :: {message}"
