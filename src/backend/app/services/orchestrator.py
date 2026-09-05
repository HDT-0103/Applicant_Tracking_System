from __future__ import annotations

from collections.abc import Sequence

from src.backend.app.schemas.orchestrator import OrchestratorDecision
from src.backend.app.services.llm_provider import LLMProvider

#: Những gì hệ thống làm được — để câu trả lời chung nói đúng về SmartATS thay
#: vì bịa tính năng. Giữ ngắn: nó đi vào mọi lượt chat ở chế độ chung.
_PRODUCT_NOTES = """
SmartATS (an applicant tracking system) does, in this order:
1. Recruiters (HR) create job postings; candidates apply through a public careers link and upload a CV.
2. The CV is parsed by an LLM, then enriched from GitHub/LinkedIn; a skill matrix compares CV skills with the posting's must-have / nice-to-have skills.
3. Candidates are ranked semantically (pgvector embeddings of CV summary + experience) against the posting; the dashboard shows a match score and must-have coverage per candidate.
4. Each posting has a review panel of tech leads; a candidate advances when at least 80% of the panel approves. Tech leads see anonymised profiles (no name/contact).
5. HR schedules interviews through Google Calendar and can send room details by email.
This assistant can: answer questions about how SmartATS works, and SEARCH candidates in the user's own workspace (postings they created, or were invited to review). It cannot create or edit postings, change review decisions, or schedule interviews.
""".strip()


class OrchestratorService:
    """Phân loại tin nhắn trước khi vào đồ thị tìm ứng viên."""

    _SYSTEM_PROMPT = """
You are the intent router of SmartATS, a recruitment assistant.

Classify the latest user message:
- CANDIDATE_SEARCH: the user wants to find, filter, rank, shortlist, compare or
  recommend candidates/resumes by skills, experience, role, location, etc.
  Set direct_response to null and put ONLY criteria explicitly present in the
  message into initial_search_criteria (keys such as role, skills,
  experience_years, seniority, location, domain). Never invent criteria.
- GENERAL_CHAT: greetings, thanks, questions about how the ATS or this
  assistant works, hiring advice, or anything that does not require retrieving
  candidates. Write a concise helpful direct_response in markdown, grounded in
  the product notes and the workspace overview below; if the data needed is not
  there, say so plainly instead of guessing.

Always answer in {language}. Propose 2-3 short suggestions the user could ask
next (same language). Return only the requested structured object.

PRODUCT NOTES:
{product_notes}

WORKSPACE OVERVIEW (what this user can see; may be empty):
{overview}
""".strip()

    def __init__(self, llm_provider: LLMProvider):
        self.llm_provider = llm_provider

    def classify(
        self,
        user_message: str,
        history: Sequence[str] = (),
        *,
        lang: str = "en",
        overview: str = "",
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
        system_prompt = self._SYSTEM_PROMPT.format(
            language="Vietnamese" if lang == "vi" else "English",
            product_notes=_PRODUCT_NOTES,
            overview=overview or "(nothing loaded)",
        )
        return self.llm_provider.invoke(
            system_prompt=system_prompt,
            user_input=user_input,
            response_model=OrchestratorDecision,
        )
