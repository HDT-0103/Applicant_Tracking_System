from __future__ import annotations

from collections.abc import Sequence

from src.backend.app.schemas.orchestrator import OrchestratorDecision
from src.backend.app.services.llm_provider import LLMProvider


class OrchestratorService:
    """Classifies chat requests before they enter the candidate-search graph."""

    _SYSTEM_PROMPT = """
You are the intent router for an ATS recruitment assistant.

Classify the latest user message:
- CANDIDATE_SEARCH: searching, filtering, recommending, comparing, or evaluating
  candidates, resumes, skills, experience, or candidate data.
- GENERAL_CHAT: greetings, general questions, explanations about the ATS, or
  conversation that does not require candidate retrieval.

For GENERAL_CHAT, write a concise helpful answer in Vietnamese unless the user
clearly uses another language. For CANDIDATE_SEARCH, set direct_response to null
and extract only criteria explicitly present in the message into
initial_search_criteria. Never invent criteria.
Return only the requested structured object.
""".strip()

    def __init__(self, llm_provider: LLMProvider):
        self.llm_provider = llm_provider

    def classify(
        self,
        user_message: str,
        history: Sequence[str] = (),
    ) -> OrchestratorDecision:
        recent_history = list(history)[-6:]
        user_input = "\n".join(
            [
                "Recent conversation:",
                *(f"- {item}" for item in recent_history),
                "Latest user message:",
                user_message,
            ]
        )
        return self.llm_provider.invoke(
            system_prompt=self._SYSTEM_PROMPT,
            user_input=user_input,
            response_model=OrchestratorDecision,
        )
