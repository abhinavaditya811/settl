"""The companion SMS leg: "I'll text you the link" - and then we actually do.

On a call the agent never speaks a URL (non-custodial, SCHEMA.md §5); the payment
link travels on this separate SMS leg. This module routes ``CallScript.sms_followup``
through the existing ``Sender`` seam on ``Channel.SMS`` - so the leg inherits every
sending guarantee for free: an escalated result is refused, the ``{{payment_link}}``
placeholder is resolved after the gate, and an unresolvable link hard-fails instead
of texting a broken message.

Mock-first like every channel: the offline default is ``MockSender`` ("would send"),
and a real SMS provider (e.g. Twilio) drops in behind the same seam later - nothing
here changes when it does.
"""

from __future__ import annotations

from settl.compliance.gate import ComplianceResult
from settl.schema.invoice import Channel, Invoice
from settl.sending.base import Sender, SendOutcome
from settl.voice.script import CallScript

__all__ = ["send_sms_followup"]


def send_sms_followup(
    invoice: Invoice,
    script: CallScript,
    compliance: ComplianceResult,
    *,
    sender: Sender,
) -> SendOutcome | None:
    """Send the call's SMS leg through ``sender`` on the SMS channel.

    ``compliance`` is the SAME gate result that cleared the call (the gate evaluated
    ``script.full``, which includes this SMS line) - the sender re-checks it anyway,
    so a non-passing result can never text. Returns None when there is no leg to
    send (a deliberately linkless script) or no phone to text."""
    if not script.sms_followup:
        return None
    if not invoice.has_phone:
        return None
    return sender.send(invoice, script.sms_followup, compliance, Channel.SMS)
