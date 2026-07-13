"""Recording-consent disclosure, keyed by the debtor's US state (spec §3a.6).

Some states require ALL parties to consent before a call is recorded ("two-party"
states); the practical, compliant move is to announce recording at call open. This
module is deliberately conservative, like every safety surface here:

  * a debtor in a known two-party state → announce;
  * a debtor whose state we DON'T know → announce anyway (unknown = strictest);
  * only a known one-party state skips the line.

The set below is the commonly-cited all-party list; it is a floor, not legal advice -
a tenant can always announce everywhere (announcing in a one-party state is never a
violation). Pure functions only; the script builder injects the line.
"""

from __future__ import annotations

# States commonly requiring all-party consent to record a call. Conservative
# inclusion on purpose (e.g. states with mixed in-person/phone rules are IN).
TWO_PARTY_CONSENT_STATES = frozenset({
    "CA", "CT", "DE", "FL", "IL", "MD", "MA", "MI", "MT", "NV", "NH", "OR", "PA", "WA",
})

# Spoken right after the AI disclosure, before the reminder.
RECORDING_LINE = "This call may be recorded."


def needs_recording_announcement(state: str | None) -> bool:
    """True when we must announce recording: a two-party state, or - conservatively -
    any debtor whose state is unknown. Only a known one-party state returns False."""
    if state is None or not state.strip():
        return True
    return state.strip().upper() in TWO_PARTY_CONSENT_STATES


def recording_disclosure(state: str | None) -> str:
    """The line to speak (empty string when no announcement is required)."""
    return RECORDING_LINE if needs_recording_announcement(state) else ""
