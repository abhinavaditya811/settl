"""Phrase patterns the compliance gate scans drafted messages for.

These are deliberately broad and conservative: in a safety gate, a false positive
(escalate a fine message to a human) is cheap; a false negative (auto-send a legal
threat) is the failure we will not accept. Patterns are matched case-insensitively
on word boundaries. New phrasing goes here, not buried in rule logic.
"""

from __future__ import annotations

import re

# Legal threats - explicit or implied legal/collections action.
LEGAL_THREAT = [
    r"\bsue\b",
    r"\blawsuit\b",
    r"\btake you to court\b",
    r"\blegal action\b",
    r"\blitigat",
    r"\bcollections?\b",
    r"\bdebt collector\b",
    r"\battorney\b",
    r"\blawyer\b",
    r"\bsmall claims\b",
    r"\bgarnish",
    r"\bplace a lien\b",
    r"\blien on\b",
    r"\bwe('| wi)ll report you\b",
]

# Consequences we can't / won't actually carry out (false-consequence claims).
UNENFORCEABLE_CONSEQUENCE = [
    r"\bcredit score\b",
    r"\bcredit bureau\b",
    r"\bcredit report\b",
    r"\bblacklist",
    r"\bruin your\b",
    r"\bseize\b",
    r"\brepossess",
    r"\bcriminal charges\b",
    r"\bhave you arrested\b",
]

# Anything that resembles giving legal advice / asserting legal obligation.
LEGAL_ADVICE = [
    r"\byou are legally (required|obligated|bound)\b",
    r"\bby law,? you must\b",
    r"\blegally obligated\b",
    r"\bunder (the )?statute\b",
    r"\byour legal rights\b",
    r"\bwe advise you\b",
]

# Tone-bound breaches (harassment / abuse). Keep minimal but real.
TONE_BREACH = [
    r"\bidiot\b",
    r"\bstupid\b",
    r"\bscam(mer)?\b",
    r"\bashamed\b",
    r"\bpay (up )?now or else\b",
    r"\bstop ignoring (me|us)\b",
]

# Signals in an INBOUND reply that the debtor disputes or wants a payment plan.
INBOUND_DISPUTE = [
    r"\bdispute",
    r"\bdon'?t owe\b",
    r"\bnever (delivered|received|ordered)\b",
    r"\bnot (our|my) (charge|invoice)\b",
    r"\bincorrect (charge|invoice|amount)\b",
    r"\bwrong amount\b",
]
INBOUND_PAYMENT_PLAN = [
    r"\bpayment plan\b",
    r"\binstall?ments?\b",
    r"\bpay (it )?(off )?over time\b",
    r"\bcan'?t (afford|pay) (it )?(all )?(right now|now)\b",
    r"\bspread (out )?the payment",
]

# A real URL in a draft. The model must never mint one - only the {{payment_link}}
# placeholder is allowed, resolved by the sender after the gate (non-custodial).
URL = [
    r"https?://\S+",
    r"\bwww\.\S+",
]


def _compile(patterns: list[str]) -> list[re.Pattern]:
    return [re.compile(p, re.IGNORECASE) for p in patterns]


def matches(text: str, patterns: list[re.Pattern]) -> list[str]:
    """Return the matched substrings (for human-readable escalation reasons)."""
    hits: list[str] = []
    for pat in patterns:
        m = pat.search(text)
        if m:
            hits.append(m.group(0))
    return hits


# Pre-compiled bundles.
LEGAL_THREAT_RE = _compile(LEGAL_THREAT)
UNENFORCEABLE_RE = _compile(UNENFORCEABLE_CONSEQUENCE)
LEGAL_ADVICE_RE = _compile(LEGAL_ADVICE)
TONE_BREACH_RE = _compile(TONE_BREACH)
INBOUND_DISPUTE_RE = _compile(INBOUND_DISPUTE)
INBOUND_PAYMENT_PLAN_RE = _compile(INBOUND_PAYMENT_PLAN)
URL_RE = _compile(URL)
