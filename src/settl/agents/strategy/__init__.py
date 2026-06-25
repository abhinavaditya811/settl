"""Strategy agent: decides timing, channel, tone, the ask, and late-fee usage."""

from settl.agents.strategy.agent import StrategyAgent
from settl.agents.strategy.bounds import ClampedModel, clamp
from settl.agents.strategy.judgment import GeminiJudgmentModel
from settl.agents.strategy.model import JudgmentModel, NoOpModel
from settl.agents.strategy.policy import (
    Action,
    StrategyDecision,
    Tone,
    decide_strategy,
)

__all__ = [
    "Action",
    "ClampedModel",
    "GeminiJudgmentModel",
    "JudgmentModel",
    "NoOpModel",
    "StrategyAgent",
    "StrategyDecision",
    "Tone",
    "clamp",
    "decide_strategy",
]
