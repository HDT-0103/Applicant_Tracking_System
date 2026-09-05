from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class IntentType(str, Enum):
    GENERAL_CHAT = "GENERAL_CHAT"
    CANDIDATE_SEARCH = "CANDIDATE_SEARCH"


class OrchestratorDecision(BaseModel):
    intent: IntentType = Field(description="The primary intent of the user request.")
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str = Field(min_length=1, max_length=1000)
    direct_response: str | None = Field(default=None, max_length=4000)
    initial_search_criteria: dict[str, Any] | None = None


class ChatResponseType(str, Enum):
    DIRECT_CHAT = "direct_chat"
    AGENT_EXECUTION = "agent_execution"


class ChatResponse(BaseModel):
    type: ChatResponseType
    content: str | None = None
    conversation_id: str
    result: dict[str, Any] | None = None
