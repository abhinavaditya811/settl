"""Safety clamp around the judgment model.

The strategy agent may consult a model (Gemini 3 Pro) to *refine* a decision, but
the model is advisory only. This wrapper guarantees, structurally, the Week-3
invariants from CLAUDE.md / TASKS.md:

  * The model may adjust only *how* we chase - tone, timing, late-fee. It can
    NEVER change *whether/what* we do: a SKIP / HOLD / REVIEW is returned exactly
    as the deterministic policy decided it, with the model's output discarded.
  * Safety-relevant fields the policy set - the action, the escalation hint
    (e.g. first_contact, consumer_debt), the audit factors, the channel - are
    always preserved from the policy, never taken from the model.
  * It never touches the compliance gate, which runs downstream untouched.

So even a buggy or adversarial model cannot turn "don't send" into "send", strip
a first-contact approval, or relax the gate. The gate stays a second, fully
independent backstop after this clamp.
"""

from __future__ import annotations

import dataclasses

from settl.agents.strategy.model import JudgmentModel
from settl.agents.strategy.policy import Action, StrategyDecision, Tone
from settl.schema.invoice import Invoice


def clamp(
    invoice: Invoice, policy: StrategyDecision, proposed: StrategyDecision
) -> StrategyDecision:
    """Fold a model's ``proposed`` decision back inside policy bounds.

    Returns a decision built from ``policy``, overlaying ONLY the fields a model is
    allowed to influence (tone, late-fee, next-touch timing). ``action`` and every
    safety/audit field always come from ``policy``.

    Judgment only refines an *actual chase*: for any non-CHASE action the model is
    ignored wholesale - this is precisely what makes a SKIP/REVIEW -> send
    impossible, no matter what the model returns.
    """
    if policy.action is not Action.CHASE:
        return policy

    # tone: accept only a valid Tone enum; anything else keeps the policy's tone.
    new_tone = proposed.tone if isinstance(proposed.tone, Tone) else policy.tone
    # late fee: the model may toggle it, but a fee can only ever be included when
    # the agreed terms allow it - the model can never invent one out of nowhere.
    new_fee = bool(proposed.include_late_fee) and invoice.late_fee_allowed
    # timing nudge (optional); ignore bools (a bool is an int subclass in Python).
    new_next = (
        proposed.next_touch_in_days
        if isinstance(proposed.next_touch_in_days, int)
        and not isinstance(proposed.next_touch_in_days, bool)
        else policy.next_touch_in_days
    )

    # Record what the model actually changed so the audit trail stays honest: the
    # policy's own reasoning is preserved and the refinement is appended, never
    # replaced by free-form model text.
    changes: list[str] = []
    if new_tone is not policy.tone:
        changes.append(f"tone {_tone(policy.tone)}->{_tone(new_tone)}")
    if new_fee != policy.include_late_fee:
        changes.append(f"late_fee {policy.include_late_fee}->{new_fee}")
    if new_next != policy.next_touch_in_days:
        changes.append(f"next_touch->{new_next}d")

    reasoning = policy.reasoning
    if changes:
        reasoning = f"{policy.reasoning} | judgment refined: {', '.join(changes)}."

    return dataclasses.replace(
        policy,
        tone=new_tone,
        include_late_fee=new_fee,
        next_touch_in_days=new_next,
        reasoning=reasoning,
    )


def _tone(tone: Tone | None) -> str:
    return tone.value if isinstance(tone, Tone) else "none"


class ClampedModel:
    """Wraps any :class:`JudgmentModel` so its output ALWAYS passes through
    :func:`clamp` before it can reach the agent. The agent wires this around every
    model (real or no-op), so the clamp is never optional."""

    def __init__(self, inner: JudgmentModel) -> None:
        self._inner = inner

    @property
    def name(self) -> str:
        return getattr(self._inner, "name", type(self._inner).__name__)

    def refine(self, invoice: Invoice, decision: StrategyDecision) -> StrategyDecision:
        proposed = self._inner.refine(invoice, decision)
        return clamp(invoice, decision, proposed)
