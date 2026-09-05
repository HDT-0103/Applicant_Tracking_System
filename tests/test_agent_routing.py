"""Chatbot ở chế độ chung (dashboard) phải phân loại ý định TRƯỚC khi vào đồ
thị tìm ứng viên: "xin chào" được trả lời ngay, tìm người mới chạy planner,
và câu trả lời cho một câu hỏi làm rõ không bị phân loại lại."""
from __future__ import annotations

import builtins
import dis
import json
import uuid

import pytest

from src.backend.app.agents import router as agent_router
from src.backend.app.agents.router import AgentChatRequest, AgentContext, _stream_agent
from src.backend.app.schemas.orchestrator import IntentType, OrchestratorDecision

HR = type("U", (), {"id": "hr-1", "role": "hr"})()


def _events(chunks):
    out = []
    for chunk in chunks:
        lines = chunk.strip().split("\n")
        out.append((lines[0].removeprefix("event: "), json.loads(lines[1].removeprefix("data: "))))
    return out


def _req(message: str, history=None, lang="vi", clarification_reply=False) -> AgentChatRequest:
    return AgentChatRequest(message=message, conversation_id=uuid.uuid4(), history=history or [],
                            clarification_reply=clarification_reply,
                            context=AgentContext(current_page="/", user_id="hr-1", lang=lang))


class _Orchestrator:
    def __init__(self, decision):
        self.decision = decision
        self.calls = []

    def classify(self, message, history=(), *, lang="en", overview=""):
        self.calls.append((message, list(history), lang, overview))
        return self.decision


class _Graph:
    def __init__(self):
        self.state = None
        self.user = None

    async def astream(self, state, stream_mode="updates"):
        self.state = state
        yield {"planner": {}}
        yield {"recruiter": {"candidate_search": {"final_decision": {"summary": "ok", "candidates": []}}}}


@pytest.fixture
def graph(monkeypatch):
    g = _Graph()

    def build(settings, user=None):
        g.user = user
        return g
    monkeypatch.setattr(agent_router, "_agent_graph", build)
    monkeypatch.setattr(agent_router, "_workspace_overview", lambda settings, user: "- Backend Dev: 3 applications")
    return g


@pytest.mark.asyncio
async def test_small_talk_is_answered_directly_and_never_enters_the_graph(monkeypatch, graph):
    orch = _Orchestrator(OrchestratorDecision(
        intent=IntentType.GENERAL_CHAT, confidence=0.9, reasoning="greeting",
        direct_response="Chào bạn! Tôi có thể tìm ứng viên hoặc giải thích hệ thống.",
        suggestions=["Tìm ứng viên Python", "Hội đồng chấm hoạt động thế nào?"],
    ))
    monkeypatch.setattr(agent_router, "_orchestrator", lambda: orch)

    events = _events([c async for c in _stream_agent(_req("xin chào"), settings=None, user=HR)])

    assert graph.state is None, "trò chuyện thường không được vào planner"
    done = events[-1]
    assert done[0] == "done" and done[1]["mode"] == "chat"
    assert done[1]["result"]["summary"].startswith("Chào bạn")
    assert done[1]["result"]["candidates"] == []
    assert done[1]["result"]["suggestions"] == ["Tìm ứng viên Python", "Hội đồng chấm hoạt động thế nào?"]
    # Ngôn ngữ giao diện và tổng quan workspace đi vào bộ điều phối.
    assert orch.calls == [("xin chào", [], "vi", "- Backend Dev: 3 applications")]


@pytest.mark.asyncio
async def test_a_search_request_enters_the_graph_with_the_extracted_criteria(monkeypatch, graph):
    orch = _Orchestrator(OrchestratorDecision(
        intent=IntentType.CANDIDATE_SEARCH, confidence=0.9, reasoning="search",
        initial_search_criteria={"role": "backend", "skills": ["Python"]},
    ))
    monkeypatch.setattr(agent_router, "_orchestrator", lambda: orch)

    events = _events([c async for c in _stream_agent(_req("tìm backend biết Python"), settings=None, user=HR)])

    assert graph.state.initial_search_criteria == {"role": "backend", "skills": ["Python"]}
    assert graph.state.candidate_search.mission.objective == "tìm backend biết Python"
    # Đồ thị được dựng cho ĐÚNG người gọi — phạm vi dữ liệu tính theo user này.
    assert graph.user is HR
    assert events[-1][0] == "done" and events[-1][1]["mode"] == "search"


@pytest.mark.asyncio
async def test_plain_history_is_context_for_the_router_not_part_of_the_objective(monkeypatch, graph):
    # Ở dashboard client gửi vài lượt gần nhất để "nói rõ hơn" có nghĩa; chúng
    # chỉ đi vào bộ điều phối, KHÔNG được ghép vào mục tiêu tìm kiếm.
    orch = _Orchestrator(OrchestratorDecision(intent=IntentType.CANDIDATE_SEARCH, confidence=1, reasoning="s"))
    monkeypatch.setattr(agent_router, "_orchestrator", lambda: orch)
    history = [{"role": "user", "content": "xin chào"}, {"role": "assistant", "content": "Chào bạn"}]

    [c async for c in _stream_agent(_req("tìm frontend", history=history), settings=None, user=HR)]

    assert graph.state.candidate_search.mission.objective == "tìm frontend"
    assert orch.calls[0][1] == ["user: xin chào", "assistant: Chào bạn"]


@pytest.mark.asyncio
async def test_answering_a_clarification_skips_the_intent_router(monkeypatch, graph):
    # "Senior Python, HCMC" đứng một mình dễ bị xếp thành trò chuyện; khi đang
    # trả lời câu hỏi làm rõ thì đi thẳng vào đồ thị với tin gốc ghép vào.
    def boom():
        raise AssertionError("không được phân loại lại")
    monkeypatch.setattr(agent_router, "_orchestrator", boom)

    events = _events([c async for c in _stream_agent(
        _req("Senior Python, HCMC", history=["tìm backend engineer"], clarification_reply=True), settings=None, user=HR)])

    assert graph.state.candidate_search.mission.objective == "tìm backend engineer\nSenior Python, HCMC"
    assert events[-1][0] == "done"


def test_the_graph_builder_only_uses_names_that_exist():
    # Một lần đổi import để lại `FallbackLLMProvider(...)` trong _agent_graph
    # mà không còn import: NameError chỉ lộ khi có người bấm tìm kiếm thật, vì
    # mọi test đều monkeypatch _agent_graph.
    globals_used = {i.argval for i in dis.get_instructions(agent_router._agent_graph) if i.opname == "LOAD_GLOBAL"}
    missing = sorted(n for n in globals_used if n not in vars(agent_router) and not hasattr(builtins, n))
    assert missing == [], f"tên chưa định nghĩa trong _agent_graph: {missing}"
