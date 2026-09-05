"""Quyết định của bộ điều phối ý định — lượt LLM đầu tiên của chatbot.

Trước đây MỌI tin nhắn ở chế độ chung đi thẳng vào đồ thị tìm ứng viên, nên
"xin chào" hay "hệ thống này chấm điểm thế nào" bị planner hỏi ngược "bạn
tuyển vị trí nào". Lấy ý tưởng từ nhánh fix-integrate-agent; thêm `suggestions`
để câu trả lời chung cũng có gợi ý hỏi tiếp như chế độ ứng viên.
"""
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
    #: Chỉ có khi GENERAL_CHAT: câu trả lời trực tiếp (markdown).
    direct_response: str | None = Field(default=None, max_length=4000)
    #: 2–3 câu hỏi tiếp theo, cùng ngôn ngữ với người dùng.
    suggestions: list[str] = Field(default_factory=list, max_length=3)
    #: Chỉ có khi CANDIDATE_SEARCH: tiêu chí bóc được từ câu hỏi, đưa vào
    #: planner để bớt hỏi lại.
    initial_search_criteria: dict[str, Any] | None = None
