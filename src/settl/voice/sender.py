"""Mock voice sender - logs the call it *would* place, dials nothing (SPEC §1, §8).

The default sender for the voice channel in every offline run and test, exactly like
``MockSender`` is for email. It subclasses ``GatedSender``, so it inherits - for free -
the guarantees that make a call as safe as an email:

  * it never acts on a script the compliance gate escalated, and
  * it hard-fails a call whose ``{{payment_link}}`` can't be resolved, so the agent
    never promises "I'll text you a link" it can't actually send (SCHEMA.md §5).

The live provider sender (Retell/Twilio + ElevenLabs TTS) swaps in behind this same
``Sender`` seam in Phase 3; nothing above it changes.
"""

from __future__ import annotations

from settl.schema.invoice import Channel, Invoice
from settl.sending.base import GatedSender

__all__ = ["MockVoiceSender"]


class MockVoiceSender(GatedSender):
    """Renders the resolved call script as a "would call" audit line. The ``message``
    it receives is ``CallScript.full`` after the gate cleared it and the sender
    resolved the payment link - so the logged line shows the real link the companion
    SMS would carry, proving the non-custodial link path stayed intact on a call."""

    def _deliver(self, invoice: Invoice, message: str, channel: Channel | None) -> str:
        to = invoice.contact_for(Channel.VOICE) or invoice.debtor_phone
        # message = spoken script + companion SMS line (already link-resolved).
        spoken, _, sms = message.partition("\n")
        line = f"would CALL {to} (voice) :: {spoken}"
        if sms:
            line += f" | would TEXT link :: {sms}"
        return line
