"""Drafting agent: generates the customer-voice message for a chase, then hands it
to the compliance gate. The visible AI — Gemini 3 Pro behind a no-op default seam."""

from settl.agents.drafting.agent import DraftedMessage, DraftingAgent
from settl.agents.drafting.grounding import (
    Grounding,
    NoOpGrounding,
    VertexSearchGrounding,
    VoiceContext,
)
from settl.agents.drafting.model import (
    DraftModel,
    GeminiDraftModel,
    NoOpDraftModel,
)
from settl.agents.drafting.prompt import DraftPrompt, build_prompt
from settl.agents.drafting.reply_agent import ReplyDraftingAgent
from settl.agents.drafting.reply_model import (
    GeminiReplyModel,
    NoOpReplyModel,
    ReplyModel,
)
from settl.agents.drafting.reply_prompt import ReplyPrompt, build_reply_prompt

__all__ = [
    "DraftPrompt",
    "DraftModel",
    "DraftedMessage",
    "DraftingAgent",
    "GeminiDraftModel",
    "Grounding",
    "NoOpDraftModel",
    "NoOpGrounding",
    "VertexSearchGrounding",
    "VoiceContext",
    "build_prompt",
    "ReplyDraftingAgent",
    "ReplyModel",
    "NoOpReplyModel",
    "GeminiReplyModel",
    "ReplyPrompt",
    "build_reply_prompt",
]
