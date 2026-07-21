"""The one non-binding negotiation round (SCHEMA.md §8): read the debtor's
response to an offered template and decide whether they accepted it or want
different terms. Deliberately confirms nothing itself - whichever way this
reads, the outcome still goes to the vendor for an explicit approve/reject
(orchestrator/payment_plan.py) before anything is binding.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum

from settl.compliance import patterns as P

_ACCEPT_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for p in (
        r"\bsounds? good\b",
        r"\bworks for me\b",
        r"\bthat works\b",
        r"\byes,? (that|this) works\b",
        r"\bi('| a)?m? (ok|okay) with\b",
        r"\bagreed?\b",
        r"\bi accept\b",
        r"\bsign(ed)? me up\b",
        r"\blet'?s do (that|this)\b",
    )
]


class NegotiationOutcome(str, Enum):
    ACCEPTED = "accepted"
    WANTS_DIFFERENT_TERMS = "wants_different_terms"


@dataclass(frozen=True)
class NegotiationResult:
    outcome: NegotiationOutcome
    # Raw text of what they asked for, when they want something different - handed
    # to the vendor as-is for their decision, NEVER parsed into a new commitment
    # here (that would be the AI negotiating, which SCHEMA.md §8 rules out).
    requested_terms: str | None
    reasoning: str


def read_response(message_text: str) -> NegotiationResult:
    hits = P.matches(message_text, _ACCEPT_PATTERNS)
    if hits:
        return NegotiationResult(
            NegotiationOutcome.ACCEPTED,
            None,
            f"matched acceptance language ({', '.join(hits)})",
        )
    return NegotiationResult(
        NegotiationOutcome.WANTS_DIFFERENT_TERMS,
        message_text,
        "no acceptance language matched - treating as a request for different terms",
    )
