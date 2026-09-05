"""Bộ điều phối ý định: một lượt LLM có cấu trúc trước đồ thị tìm ứng viên.
Lấy từ nhánh fix-integrate-agent, thêm ngôn ngữ + tổng quan workspace."""
from typing import Any

from pydantic import BaseModel

from src.backend.app.schemas.orchestrator import IntentType, OrchestratorDecision
from src.backend.app.services.llm_provider import LLMProvider
from src.backend.app.services.orchestrator import OrchestratorService


class StubLLMProvider(LLMProvider):
    def __init__(self, decision: OrchestratorDecision):
        self.decision = decision
        self.last_input = ""
        self.last_system = ""
        self.last_model: type[BaseModel] | None = None

    def invoke(self, system_prompt: str, user_input: Any, response_model: type[BaseModel] | None = None,
               temperature: float = 0.1) -> Any:
        self.last_system = system_prompt
        self.last_input = str(user_input)
        self.last_model = response_model
        return self.decision


def test_orchestrator_uses_structured_decision_and_recent_history():
    provider = StubLLMProvider(OrchestratorDecision(
        intent=IntentType.CANDIDATE_SEARCH, confidence=0.95,
        reasoning="The user asks to find candidates.", initial_search_criteria={"skills": ["Python"]},
    ))
    decision = OrchestratorService(provider).classify(
        "Tìm ứng viên Python",
        ["old message", "c1", "c2", "c3", "c4", "c5", "c6", "latest context"],
    )
    assert decision.intent == IntentType.CANDIDATE_SEARCH
    assert decision.initial_search_criteria == {"skills": ["Python"]}
    assert provider.last_model is OrchestratorDecision
    assert "old message" not in provider.last_input
    assert "latest context" in provider.last_input


def test_orchestrator_supports_direct_chat_with_suggestions():
    provider = StubLLMProvider(OrchestratorDecision(
        intent=IntentType.GENERAL_CHAT, confidence=0.99, reasoning="greeting",
        direct_response="Xin chào, tôi có thể giúp gì?", suggestions=["Tìm ứng viên Python", "Hệ thống chấm điểm thế nào?"],
    ))
    decision = OrchestratorService(provider).classify("Xin chào")
    assert decision.intent == IntentType.GENERAL_CHAT
    assert decision.direct_response == "Xin chào, tôi có thể giúp gì?"
    assert len(decision.suggestions) == 2


def test_language_and_workspace_overview_reach_the_prompt():
    # Câu trả lời chung phải cùng ngôn ngữ giao diện và biết người này thấy
    # tin nào — nếu không "tin nào nhiều ứng viên nhất" chỉ có thể bịa.
    provider = StubLLMProvider(OrchestratorDecision(intent=IntentType.GENERAL_CHAT, confidence=1, reasoning="x"))
    OrchestratorService(provider).classify("hi", lang="vi", overview="- Backend Dev [PUBLISHED]: 4 applications")
    assert "Vietnamese" in provider.last_system
    assert "Backend Dev [PUBLISHED]: 4 applications" in provider.last_system
    assert "80% of the panel" in provider.last_system  # ghi chú sản phẩm đi kèm
