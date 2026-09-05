from typing import Any

from pydantic import BaseModel

from src.backend.app.schemas.orchestrator import IntentType, OrchestratorDecision
from src.backend.app.services.llm_provider import LLMProvider
from src.backend.app.services.orchestrator import OrchestratorService


class StubLLMProvider(LLMProvider):
    def __init__(self, decision: OrchestratorDecision):
        self.decision = decision
        self.last_input = ""
        self.last_model: type[BaseModel] | None = None

    def invoke(
        self,
        system_prompt: str,
        user_input: Any,
        response_model: type[BaseModel] | None = None,
        temperature: float = 0.1,
    ) -> Any:
        self.last_input = str(user_input)
        self.last_model = response_model
        return self.decision


def test_orchestrator_uses_structured_decision_and_recent_history():
    provider = StubLLMProvider(
        OrchestratorDecision(
            intent=IntentType.CANDIDATE_SEARCH,
            confidence=0.95,
            reasoning="The user asks to find candidates.",
            initial_search_criteria={"skills": ["Python"]},
        )
    )

    decision = OrchestratorService(provider).classify(
        "Tìm ứng viên Python",
        ["old message", "context 1", "context 2", "context 3", "context 4", "context 5", "context 6", "latest context"],
    )

    assert decision.intent == IntentType.CANDIDATE_SEARCH
    assert decision.initial_search_criteria == {"skills": ["Python"]}
    assert provider.last_model is OrchestratorDecision
    assert "old message" not in provider.last_input
    assert "latest context" in provider.last_input


def test_orchestrator_supports_direct_chat_contract():
    provider = StubLLMProvider(
        OrchestratorDecision(
            intent=IntentType.GENERAL_CHAT,
            confidence=0.99,
            reasoning="The user greeted the assistant.",
            direct_response="Xin chào, tôi có thể giúp gì?",
        )
    )

    decision = OrchestratorService(provider).classify("Xin chào")

    assert decision.intent == IntentType.GENERAL_CHAT
    assert decision.direct_response == "Xin chào, tôi có thể giúp gì?"