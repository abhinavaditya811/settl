"""Builds the spoken call script from a drafted reminder (VOICE_AGENT_SPEC §5).

A call is just a "send" on the voice channel, so the script is what flows through the
compliance gate and the sender - exactly like an email body does. This module is pure
and unit-testable: no audio, no telephony, no provider. It only assembles text.

Two invariants live here so the gate and the non-custodial guarantee still hold on a
call:

  * The script OPENS with an AI-voice disclosure. The gate re-checks this
    independently (``rule_voice_disclosure``); we don't rely on the gate trusting us.
  * A URL is never spoken. The reminder's ``{{payment_link}}`` placeholder is stripped
    from the spoken part and moved into a companion SMS line, which still carries the
    placeholder - so the sender's payment-link resolution + hard-fail (SCHEMA.md §5)
    applies to a call the same way it does to an email. The words come from the
    tenant's CustomerVoiceProfile (drafting); this module only frames them.
"""

from __future__ import annotations

from dataclasses import dataclass

from settl.schema.invoice import PAYMENT_LINK_PLACEHOLDER

# The AI-voice disclosure spoken first on every call, for BOTH the default and the
# cloned voice (§3a.1). Phrased to satisfy ``patterns.AI_DISCLOSURE_RE``.
DISCLOSURE_TEMPLATE = (
    "Hi, this is an AI assistant calling on behalf of {business}."
)
# The compliant close: we never take payment on the call, we text a link (§3a.10).
LINK_CLOSE = "I'll text you a secure link to pay right after this call."
# The companion SMS that carries the real link. Keeps the {{payment_link}} placeholder
# so the sender resolves it after the gate (and hard-fails if it can't).
SMS_TEMPLATE = "Here is your secure payment link: " + PAYMENT_LINK_PLACEHOLDER


def _spoken_reminder(reminder: str) -> str:
    """The drafted reminder with any payment-link placeholder stripped (you don't read
    a URL aloud) and whitespace tidied. The link is delivered by the companion SMS."""
    stripped = reminder.replace(PAYMENT_LINK_PLACEHOLDER, " ")
    return " ".join(stripped.split())


@dataclass(frozen=True)
class CallScript:
    """The two legs of a voice touch: what's said aloud, and the link text.

    ``full`` is what the pipeline passes to the gate and sender - it contains the
    disclosure (so ``rule_voice_disclosure`` passes) and the ``{{payment_link}}``
    placeholder (so the sender's resolution + hard-fail still guards the call)."""

    spoken: str  # disclosure + reminder + the "I'll text you the link" close
    sms_followup: str  # the companion text, carries {{payment_link}}

    @property
    def full(self) -> str:
        return f"{self.spoken}\n{self.sms_followup}"


def build_call_script(
    *,
    business_name: str,
    reminder: str,
    include_payment_link: bool = True,
) -> CallScript:
    """Assemble the call script: AI disclosure → the drafted reminder → link close.

    ``reminder`` is the message drafting already produced (in the tenant's writing
    voice). ``include_payment_link`` is True for a normal chase; set False only when
    there is deliberately no link leg (the gate/sender then have nothing to resolve).
    """
    disclosure = DISCLOSURE_TEMPLATE.format(business=business_name)
    body = _spoken_reminder(reminder)
    if include_payment_link:
        spoken = f"{disclosure} {body} {LINK_CLOSE}".strip()
        return CallScript(spoken=spoken, sms_followup=SMS_TEMPLATE)
    spoken = f"{disclosure} {body}".strip()
    return CallScript(spoken=spoken, sms_followup="")
