"""Câu hỏi làm rõ của agent phải tới người dùng qua HTTP, không chặn ở stdin.

Gateway CLI gọi `input()` trên server: production ném EOFError và chat chỉ
thấy "The agent could not complete this request." trong khi câu hỏi thật
("Could you provide more details about the role…") nằm trong log.
"""
from __future__ import annotations

import json
import uuid

import pytest

from src.backend.app.agents import router as agent_router
from src.backend.app.agents.router import (
    AgentChatRequest,
    AgentContext,
    ClarificationNeeded,
    HttpInteractionGateway,
    _stream_agent,
)


class _SearchIntent:
    """Bộ điều phối giả: mọi tin đều là yêu cầu tìm ứng viên."""

    def classify(self, message, history=(), *, lang="en", overview=""):
        from src.backend.app.schemas.orchestrator import IntentType, OrchestratorDecision
        return OrchestratorDecision(intent=IntentType.CANDIDATE_SEARCH, confidence=1, reasoning="search")


@pytest.fixture(autouse=True)
def _no_real_llm(monkeypatch):
    monkeypatch.setattr(agent_router, "_orchestrator", lambda: _SearchIntent())
    monkeypatch.setattr(agent_router, "_workspace_overview", lambda settings, user: "")


def _events(chunks: list[str]) -> list[tuple[str, dict]]:
    out = []
    for chunk in chunks:
        lines = chunk.strip().split("\n")
        event = lines[0].removeprefix("event: ")
        data = json.loads(lines[1].removeprefix("data: "))
        out.append((event, data))
    return out


class _AsksFirst:
    """Đồ thị giả: node đầu xong, node thứ hai hỏi lại người dùng."""

    def __init__(self) -> None:
        self.seen_objective: str | None = None

    async def astream(self, state, stream_mode="updates"):
        self.seen_objective = state.candidate_search.mission.objective
        yield {"planner": {}}
        raise ClarificationNeeded("Which role are you hiring for?")


@pytest.mark.asyncio
async def test_the_http_gateway_never_reads_stdin():
    with pytest.raises(ClarificationNeeded) as exc:
        await HttpInteractionGateway().ask("Which role?")
    assert exc.value.question == "Which role?"


@pytest.mark.asyncio
async def test_a_clarification_is_a_reply_not_an_error(monkeypatch):
    graph = _AsksFirst()
    monkeypatch.setattr(agent_router, "_agent_graph", lambda settings, user=None: graph)
    req = AgentChatRequest(
        message="hello",
        conversation_id=uuid.uuid4(),
        context=AgentContext(current_page="/", user_id="u-1"),
    )

    events = _events([chunk async for chunk in _stream_agent(req, settings=None)])

    # status "Understanding…" (bộ điều phối), "thinking", "Completed planner", rồi câu hỏi.
    assert [e for e, _ in events] == ["status", "status", "status", "done"]
    done = events[-1][1]
    assert done["clarification"] is True
    assert done["result"] == {"summary": "Which role are you hiring for?", "candidates": []}


@pytest.mark.asyncio
async def test_the_answer_to_a_clarification_keeps_the_original_request(monkeypatch):
    # Planner chỉ đọc tin nhắn cuối: không ghép thì "Senior Python, HCMC" mất
    # mối liên hệ với "tìm backend engineer" ở lượt trước.
    graph = _AsksFirst()
    monkeypatch.setattr(agent_router, "_agent_graph", lambda settings, user=None: graph)
    req = AgentChatRequest(
        message="Senior Python, HCMC",
        history=["find me a backend engineer"],
        clarification_reply=True,
        conversation_id=uuid.uuid4(),
        context=AgentContext(current_page="/", user_id="u-1"),
    )
    [chunk async for chunk in _stream_agent(req, settings=None)]
    assert graph.seen_objective == "find me a backend engineer\nSenior Python, HCMC"
