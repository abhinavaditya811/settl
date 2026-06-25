"""Week 3: the judgment clamp + the Gemini judgment model's safety and fail-safe.

Fully offline - no API key, no SDK, no network. The live Gemini call is exercised
separately by the smoke test. Here we prove the *guarantees*: the clamp can't be
tricked into a send, and the model degrades safely when Gemini is unavailable.
"""

import dataclasses

import pytest

from settl.agents.strategy import (
    Action,
    GeminiJudgmentModel,
    StrategyAgent,
    Tone,
    clamp,
    decide_strategy,
)
from settl.agents.strategy.judgment import JudgmentSuggestion
from settl.data import load_synthetic_invoices


def _by_id():
    return {inv.invoice_id: inv for inv in load_synthetic_invoices()}


@pytest.fixture(autouse=True)
def _hermetic_env(monkeypatch):
    """Make judgment tests independent of any real .env or shell credentials."""
    monkeypatch.setattr(
        "settl.agents.strategy.judgment.load_dotenv", lambda *a, **k: {}
    )
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)


# --- fakes -------------------------------------------------------------------


class _RogueModel:
    """A model that tries to turn every decision into an aggressive immediate send."""

    name = "rogue"

    def refine(self, invoice, decision):
        return dataclasses.replace(
            decision,
            action=Action.CHASE,        # tries to force a send
            tone=Tone.FINAL,
            include_late_fee=True,      # tries to add a fee even if terms forbid
            escalation_hint=None,       # tries to strip first-contact approval
            factors={},                 # tries to wipe the audit trail
        )


class _ToneOnlyModel:
    name = "tone-only"

    def __init__(self, tone):
        self._tone = tone

    def refine(self, invoice, decision):
        return dataclasses.replace(decision, tone=self._tone)


class _FakeResponse:
    def __init__(self, suggestion=None, text=None):
        self.parsed = suggestion
        self.text = text


class _FakeModels:
    def __init__(self, response=None, error=None):
        self._response, self._error = response, error

    def generate_content(self, **kwargs):
        if self._error:
            raise self._error
        return self._response


class _FakeClient:
    def __init__(self, response=None, error=None):
        self.models = _FakeModels(response, error)


# --- the clamp: action / safety fields can never change ----------------------


@pytest.mark.parametrize("inv_id", ["INV-005", "INV-003", "INV-004", "INV-009"])
def test_rogue_model_cannot_flip_a_non_chase_into_a_send(inv_id):
    """SKIP / REVIEW / HOLD come back exactly as the policy decided - model output
    discarded - so a rogue model can never manufacture a send."""
    inv = _by_id()[inv_id]
    policy = decide_strategy(inv)
    assert policy.action is not Action.CHASE
    decided = StrategyAgent(model=_RogueModel()).decide(inv)
    assert decided.action is policy.action


def test_clamp_keeps_action_and_safety_fields_on_a_chase():
    inv = _by_id()["INV-001"]  # CHASE, friendly, first_contact, terms forbid a fee
    policy = decide_strategy(inv)
    decided = StrategyAgent(model=_RogueModel()).decide(inv)
    assert decided.action is Action.CHASE            # not overridden into a raw send
    assert decided.escalation_hint == "first_contact"  # approval preserved
    assert decided.factors == policy.factors         # audit trail preserved
    assert decided.include_late_fee is False         # terms forbid -> fee blocked
    assert decided.tone is Tone.FINAL                # tone WAS allowed to change


def test_clamp_lets_a_model_refine_tone_on_a_chase():
    inv = _by_id()["INV-002"]
    decided = StrategyAgent(model=_ToneOnlyModel(Tone.FINAL)).decide(inv)
    assert decided.action is Action.CHASE
    assert decided.tone is Tone.FINAL
    assert "judgment refined" in decided.reasoning


def test_clamp_is_identity_for_the_default_noop_model():
    inv = _by_id()["INV-002"]
    policy = decide_strategy(inv)
    decided = StrategyAgent().decide(inv)  # NoOp model, still wrapped in the clamp
    assert decided.action is policy.action
    assert decided.tone is policy.tone
    assert decided.include_late_fee == policy.include_late_fee


def test_clamp_function_returns_non_chase_untouched():
    inv = _by_id()["INV-005"]
    policy = decide_strategy(inv)  # SKIP
    proposed = dataclasses.replace(policy, action=Action.CHASE, tone=Tone.FINAL)
    assert clamp(inv, policy, proposed) is policy


# --- GeminiJudgmentModel: fail-safe + applies a valid suggestion -------------


def test_judgment_with_no_key_keeps_policy(monkeypatch):
    inv = _by_id()["INV-002"]
    policy = decide_strategy(inv)
    model = GeminiJudgmentModel(client=_FakeClient(error=AssertionError("must not call")))
    assert model.refine(inv, policy) == policy  # no key -> no call -> unchanged


def test_judgment_skips_non_chase_without_calling(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    inv = _by_id()["INV-005"]  # SKIP
    policy = decide_strategy(inv)
    model = GeminiJudgmentModel(client=_FakeClient(error=AssertionError("must not call")))
    assert model.refine(inv, policy) == policy


def test_judgment_is_fail_safe_on_api_error(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    inv = _by_id()["INV-002"]
    policy = decide_strategy(inv)
    model = GeminiJudgmentModel(client=_FakeClient(error=RuntimeError("boom")))
    assert model.refine(inv, policy) == policy  # API blew up -> deterministic decision


def test_judgment_applies_a_valid_suggestion(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    inv = _by_id()["INV-002"]  # CHASE, late_fee_allowed True
    policy = decide_strategy(inv)
    sugg = JudgmentSuggestion(
        tone="final_notice", include_late_fee=False, rationale="age warrants firmer tone"
    )
    model = GeminiJudgmentModel(client=_FakeClient(response=_FakeResponse(suggestion=sugg)))
    out = model.refine(inv, policy)
    assert out.tone is Tone.FINAL
    assert out.include_late_fee is False
    assert out.action is Action.CHASE  # action never changes


def test_judgment_never_adds_a_fee_the_terms_forbid(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    inv = _by_id()["INV-001"]  # late_fee_allowed False
    policy = decide_strategy(inv)
    sugg = JudgmentSuggestion(
        tone="firm_reminder", include_late_fee=True, rationale="tries to add a fee"
    )
    model = GeminiJudgmentModel(client=_FakeClient(response=_FakeResponse(suggestion=sugg)))
    out = model.refine(inv, policy)
    assert out.include_late_fee is False  # terms forbid -> dropped
    assert out.tone is Tone.FIRM


def test_judgment_parses_raw_json_text_when_parsed_is_absent(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    inv = _by_id()["INV-002"]
    policy = decide_strategy(inv)
    raw = '{"tone": "friendly_reminder", "include_late_fee": false, "rationale": "ok"}'
    model = GeminiJudgmentModel(client=_FakeClient(response=_FakeResponse(text=raw)))
    out = model.refine(inv, policy)
    assert out.tone is Tone.FRIENDLY
    assert out.include_late_fee is False
