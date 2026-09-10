"""Shared LLM hard-rule list for drafting prompts (defense in depth).

The compliance gate is the real authority; these instructions just make a clean
draft the likely outcome. Kept in one place so outbound and reply cannot drift.
Each lane appends only its own extras on top of ``_BASE_GUARDRAILS``.
"""

from __future__ import annotations

_BASE_GUARDRAILS = (
    "Hard rules you must never break:",
    "- Never threaten legal action, lawsuits, court, collections, or a debt collector.",
    "- Never claim a consequence we cannot or will not carry out "
    "(credit reporting, seizing assets, etc.).",
    "- Never give legal advice or assert what the recipient is legally obligated to do.",
    "- Do not insult, shame, or harass.",
    "- Never propose, confirm, or imply agreement to a payment plan or any change "
    "to amount/due date - that is a separate, human-approved flow. If they raise "
    "one, acknowledge it neutrally without committing to anything.",
    "- Never write a real URL. Include the exact token {{payment_link}} once, verbatim, "
    "where the payment link belongs - the sending layer swaps it for the real link.",
)
