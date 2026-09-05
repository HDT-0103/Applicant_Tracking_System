"""Chế độ hỏi đáp về MỘT ứng viên đang mở.

Đồ thị "tìm ứng viên" hỏi ngược "bạn tuyển vị trí nào" dù người dùng đang đứng
trên trang của ứng viên. Chế độ này nạp đúng hồ sơ đó, che PII theo role NGAY
TRONG DỮ LIỆU đưa vào prompt (không tin lời dặn LLM), và trả lời một lượt kèm
gợi ý câu hỏi tiếp theo.
"""
from __future__ import annotations

import json
import uuid
from types import SimpleNamespace

import pytest

from src.backend.app.agents import router as agent_router
from src.backend.app.agents.candidate_qa import (
    CandidateAnswer,
    HistoryTurn,
    build_conversation,
    build_system_prompt,
    load_candidate_context,
    mask_context,
)
from src.backend.app.agents.router import AgentChatRequest, AgentContext, _stream_agent

CONTEXT = {
    "candidate_uuid": "8b5c4334-0000-4000-8000-000000000000",
    "candidate": {"full_name": "Trần Bảo", "email": "bao@example.com", "current_company": "Acme"},
    "cv_text": "Trần Bảo — 5 năm Python, FastAPI, Postgres. Email bao@example.com",
    "enrichment": {"match_confidence_score": 88, "skills_matrix": {"must_have": {"matched": ["Python"]}}},
    "github": {"public_repos_count": 12, "top_languages": {"Python": 70}},
    "application": {"status": "APPLIED", "expected_salary_max": 3000, "skill_ratings": {"Python": 4}},
    "job_posting": {"job_title": "Senior Backend Engineer", "must_have_skills": ["Python"]},
}


class TestPromptMasking:
    def test_hr_prompt_carries_the_cv_and_the_name(self):
        prompt = build_system_prompt(CONTEXT, "en")
        assert "Trần Bảo" in prompt and "5 năm Python" in prompt
        assert "Answer in English" in prompt

    def test_tech_lead_prompt_never_contains_pii_even_if_the_llm_is_told_nothing(self):
        # Che ở dữ liệu, không ở lời dặn: tech lead hỏi khéo cũng không moi được.
        masked = mask_context(CONTEXT, "tech_lead")
        prompt = build_system_prompt(masked, "vi")
        assert "Trần Bảo" not in prompt and "bao@example.com" not in prompt
        assert "5 năm Python" not in prompt  # CV thô không đi vào prompt của tech lead
        assert "Candidate #8b5c4334" in prompt
        assert "Answer in Vietnamese" in prompt
        # Cái tech lead cần để chấm thì vẫn còn: GitHub, ma trận kỹ năng, tự đánh
        # giá, và tin tuyển dụng (không phải dữ liệu ứng viên).
        assert "public_repos_count" in prompt and "skills_matrix" in prompt
        assert '"skill_ratings": {"Python": 4}' in prompt
        assert "Senior Backend Engineer" in prompt
        # Lương mong muốn là việc của HR.
        assert "3000" not in prompt

    def test_hr_context_is_not_masked_at_all(self):
        masked = mask_context(CONTEXT, "hr")
        assert masked["candidate"]["full_name"] == "Trần Bảo"
        assert masked["cv_text"] == CONTEXT["cv_text"]

    def test_the_conversation_keeps_only_recent_turns_and_ends_with_the_question(self):
        turns = [HistoryTurn(role="user", content=f"q{i}") for i in range(12)]
        text = build_conversation(turns, "the core skills")
        assert "q0" not in text and "q11" in text
        assert text.endswith("User: the core skills")


def _req(candidate: str | None, history=None) -> AgentChatRequest:
    return AgentChatRequest(
        message="ứng viên này có gì nổi bật",
        conversation_id=uuid.uuid4(),
        history=history or [],
        context=AgentContext(current_page="/candidate-profile/enriched", user_id="u-1",
                             candidate_uuid=candidate, lang="vi"),
    )


def _events(chunks):
    out = []
    for chunk in chunks:
        lines = chunk.strip().split("\n")
        out.append((lines[0].removeprefix("event: "), json.loads(lines[1].removeprefix("data: "))))
    return out


HR = SimpleNamespace(id="hr-1", role="hr")


@pytest.mark.asyncio
async def test_with_a_candidate_open_the_answer_is_about_that_candidate(monkeypatch):
    seen = {}
    async def allow(candidate_uuid, user, settings): return True
    def fake_load(client, candidate_uuid, role):
        seen["loaded"] = (candidate_uuid, role); return CONTEXT
    def fake_answer(*, llm, context, lang, message, history):
        seen["asked"] = (lang, message, [h.content for h in history])
        return CandidateAnswer(answer="Mạnh về Python/FastAPI.", suggestions=["Có rủi ro gì?", "Gợi ý câu hỏi phỏng vấn"])
    monkeypatch.setattr(agent_router, "_candidate_access", allow)
    monkeypatch.setattr(agent_router, "load_candidate_context", fake_load)
    monkeypatch.setattr(agent_router, "answer_about_candidate", fake_answer)
    monkeypatch.setattr(agent_router, "get_supabase_admin_client", lambda settings: object())
    monkeypatch.setattr(agent_router, "_agent_graph", lambda settings: (_ for _ in ()).throw(AssertionError("không được đi vào đồ thị tìm ứng viên")))

    req = _req(CONTEXT["candidate_uuid"], history=[{"role": "user", "content": "hello"}, {"role": "assistant", "content": "Chào bạn"}])
    events = _events([c async for c in _stream_agent(req, settings=None, user=HR)])

    assert events[-1][0] == "done"
    done = events[-1][1]
    assert done["mode"] == "candidate"
    assert done["result"]["summary"] == "Mạnh về Python/FastAPI."
    assert done["result"]["suggestions"] == ["Có rủi ro gì?", "Gợi ý câu hỏi phỏng vấn"]
    assert seen["loaded"] == (CONTEXT["candidate_uuid"], "hr")
    assert seen["asked"] == ("vi", "ứng viên này có gì nổi bật", ["hello", "Chào bạn"])


@pytest.mark.asyncio
async def test_a_candidate_outside_the_scope_is_not_found(monkeypatch):
    async def deny(candidate_uuid, user, settings): return False
    monkeypatch.setattr(agent_router, "_candidate_access", deny)
    events = _events([c async for c in _stream_agent(_req("someone-else"), settings=None, user=HR)])
    assert events == [("error", {"message": "Candidate not found."})]


@pytest.mark.asyncio
async def test_without_a_candidate_the_search_graph_still_runs(monkeypatch):
    class _Graph:
        async def astream(self, state, stream_mode="updates"):
            yield {"planner": {}}
    monkeypatch.setattr(agent_router, "_agent_graph", lambda settings: _Graph())
    events = _events([c async for c in _stream_agent(_req(None), settings=None, user=HR)])
    assert [e for e, _ in events][:2] == ["status", "status"]


class TestColumnNamesMatchTheSchema:
    """Sai tên cột chỉ lộ ra khi có người bấm vào chat — bản đầu tiên hỏi
    `candidates.summary`, một cột không tồn tại, và mọi câu hỏi đều 500."""

    @staticmethod
    def _schema_columns() -> dict[str, set[str]]:
        import re
        from pathlib import Path
        text = Path(__file__).resolve().parents[1].joinpath("docs/supabase_schema.md").read_text()
        tables: dict[str, set[str]] = {}
        for m in re.finditer(r"CREATE TABLE public\.(\w+) \((.*?)\n\);", text, re.S):
            cols = {line.strip().split()[0] for line in m.group(2).splitlines()
                    if line.strip() and not line.strip().startswith(("CONSTRAINT", "--"))}
            tables[m.group(1)] = cols
        return tables

    def test_every_selected_column_exists(self):
        from unittest.mock import MagicMock
        asked: list[tuple[str, str]] = []

        class _Client:
            def table(self, name):
                b = MagicMock()
                def select(cols):
                    asked.append((name, cols)); return b
                b.select.side_effect = select
                b.eq.return_value = b; b.order.return_value = b; b.limit.return_value = b
                b.execute.return_value = MagicMock(data=[])
                return b

        load_candidate_context(_Client(), "cand-1", "hr")
        schema = self._schema_columns()
        missing = []
        for table, cols in asked:
            for col in [c.strip() for c in cols.split(",")]:
                if col not in schema.get(table, set()):
                    missing.append(f"{table}.{col}")
        assert missing == []
