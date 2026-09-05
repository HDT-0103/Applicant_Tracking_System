from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from typing import Annotated, Literal, Optional, Union
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from groq import (
    APIConnectionError,
    APIError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    GroqError,
    RateLimitError,
)
from modules.auth.domain.models import AuthUser
from modules.search.application.search_service import get_embedding_service
from modules.search.application.scoped_search import ScopedCandidateSearchService
from modules.search.infra.legacy_bridge import (
    CandidateSearchRepository,
    EnrichmentRepository,
    RankingService,
)
from modules.search.infra.scope import SupabaseSearchScope
from modules.shared.domain.job_visibility import visible_job_posting_ids
from modules.shared.infrastructure.auth_dependencies import require_operational_roles
from modules.shared.infrastructure.config import Settings, get_settings
from modules.shared.infrastructure.rate_limit import agent_rate_limit
from modules.shared.infrastructure.supabase_client import get_supabase_admin_client
from pydantic import BaseModel, Field

from src.backend.app.agents.candidate_qa import (
    CandidateAnswer,
    HistoryTurn,
    answer_about_candidate,
    load_candidate_context,
)
from src.backend.app.agents.nodes.interaction import HumanInteractionGateway
from src.backend.app.agents.state import (
    ATSState,
    CandidateSearchState,
    RecruiterDecisionOutput,
    Mission,
    MissionStatus,
)
from src.backend.app.schemas.orchestrator import IntentType, OrchestratorDecision
from src.backend.app.services.llm_provider import build_default_llm_provider
from src.backend.app.services.orchestrator import OrchestratorService

router = APIRouter(prefix="/agents", tags=["agents"])
logger = logging.getLogger(__name__)


class AgentContext(BaseModel):
    current_page: str = Field(default="candidates_dashboard", max_length=100)
    user_id: str = Field(min_length=1, max_length=200)
    #: Ứng viên đang mở trên màn hình. Có → chế độ hỏi đáp về đúng người đó
    #: (candidate_qa.py); không → chế độ tìm ứng viên (đồ thị agent).
    candidate_uuid: Optional[str] = Field(default=None, max_length=100)
    #: Ngôn ngữ giao diện, để trả lời cùng ngôn ngữ.
    lang: Literal["en", "vi"] = "en"


class AgentChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)
    conversation_id: UUID
    context: AgentContext
    #: Lịch sử phiên. Chế độ hỏi đáp ứng viên: các lượt {role, content} gần
    #: nhất để "the core skills" được hiểu là câu tiếp theo. Chế độ tìm ứng
    #: viên: chỉ tin TRƯỚC của người dùng khi họ trả lời câu hỏi làm rõ (planner
    #: chỉ đọc tin cuối nên phải ghép lại).
    history: list[Union[str, HistoryTurn]] = Field(default_factory=list, max_length=12)
    #: Đang trả lời câu hỏi làm rõ của agent: `history` khi đó là tin gốc của
    #: người dùng, được ghép vào tin này thành một yêu cầu và bỏ qua bộ điều
    #: phối. Không có cờ thì `history` chỉ là ngữ cảnh cho bộ điều phối / hỏi
    #: đáp ứng viên — không bao giờ bị ghép vào mục tiêu tìm kiếm.
    clarification_reply: bool = False
    #: Tiêu chí bộ điều phối bóc sẵn; route tự điền, client không cần gửi.
    initial_search_criteria: Optional[dict[str, object]] = None

    def user_history(self) -> list[str]:
        return [h if isinstance(h, str) else h.content for h in self.history
                if isinstance(h, str) or h.role == "user"]

    def turns(self) -> list[HistoryTurn]:
        return [h if isinstance(h, HistoryTurn) else HistoryTurn(role="user", content=h) for h in self.history]


class ClarificationNeeded(Exception):
    """Agent cần hỏi lại người dùng trước khi làm tiếp."""

    def __init__(self, question: str) -> None:
        super().__init__(question)
        self.question = question


class HttpInteractionGateway(HumanInteractionGateway):
    """Gateway cho HTTP: không chờ được câu trả lời trong cùng một request.

    Gateway CLI cũ gọi `input()` — đọc stdin của SERVER — nên trên production
    nó ném `EOFError`, câu hỏi làm rõ không bao giờ tới người dùng và chat chỉ
    thấy "The agent could not complete this request." Ở đây câu hỏi được ném
    lên để route trả về cho client như một lượt trả lời; người dùng đáp lại
    bằng request tiếp theo (kèm `history`).
    """

    async def ask(self, question: str) -> str:
        raise ClarificationNeeded(question)


def _agent_graph(settings: Settings, user: AuthUser | None = None):
    # Import lazily because graph.py imports the route decision functions from
    # this module while the application is importing the router.
    from src.backend.app.agents.graph import build_graph

    client = get_supabase_admin_client(settings)
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent search is unavailable: the database is not configured.",
        )

    # Tìm trong phạm vi người gọi (tin mình tạo / hội đồng mình ở trong), như
    # màn hình /search. Không có user → role None → không thấy ai (fail-closed).
    search_service = ScopedCandidateSearchService(
        scope=SupabaseSearchScope(client),
        user_id=user.id if user else "",
        role=user.role if user else None,
        search_repository=CandidateSearchRepository(client),
        enrichment_repository=EnrichmentRepository(client),
        embedding_service=get_embedding_service(),
        ranking_service=RankingService(),
    )
    return build_graph(
        llm_provider=_llm_provider(),
        search_service=search_service,
        interaction_gateway=HttpInteractionGateway(),
    )


def _sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _agent_error_message(error: Exception) -> str:
    if isinstance(error, HTTPException):
        return str(error.detail)
    if isinstance(error, RateLimitError):
        return "The AI service is rate-limited. Please try again in a moment."
    if isinstance(error, (AuthenticationError, BadRequestError)):
        return "The AI service is not configured correctly. Please contact an administrator."
    if isinstance(error, (APITimeoutError, APIConnectionError, TimeoutError, asyncio.TimeoutError)):
        return "The AI service did not respond in time. Please try again."
    if isinstance(error, APIError):
        return "The AI service is temporarily unavailable. Please try again."
    if isinstance(error, GroqError):
        return "The AI service is not configured correctly. Please contact an administrator."
    return "The agent could not complete this request."


def _extract_final_decision(value: object):
    if isinstance(value, dict):
        if "final_decision" in value:
            return value["final_decision"]
        for nested in value.values():
            decision = _extract_final_decision(nested)
            if decision is not None:
                return decision
    if isinstance(value, (list, tuple)):
        for nested in value:
            decision = _extract_final_decision(nested)
            if decision is not None:
                return decision
    decision = getattr(value, "final_decision", None)
    if decision is not None:
        return decision
    candidate_search = getattr(value, "candidate_search", None)
    if candidate_search is not None:
        return _extract_final_decision(candidate_search)
    return None


def _llm_provider():
    return build_default_llm_provider()


def _orchestrator() -> OrchestratorService:
    return OrchestratorService(_llm_provider())


#: Trần số tin đưa vào prompt tổng quan — đủ cho một HR, không phình prompt.
MAX_OVERVIEW_JOBS = 20


def _workspace_overview(settings: Settings, user: AuthUser | None) -> str:
    """Vài dòng về tin và số hồ sơ người này được thấy, cho câu trả lời chung
    ("tin nào nhiều ứng viên nhất?"). Hỏng thì trả rỗng — chat vẫn chạy, chỉ
    không có số liệu; KHÔNG bịa số."""
    if user is None:
        return ""
    try:
        client = get_supabase_admin_client(settings)
        if client is None:
            return ""
        scope = SupabaseSearchScope(client)
        allowed = visible_job_posting_ids(user.role, user.id, scope)
        if allowed is not None and not allowed:
            return "The user has no job postings in their workspace yet."
        # Cùng cách đếm nhúng `applications(count)` mà sidebar dùng: 1 truy vấn.
        query = client.table("jobs_posting").select("id, job_title, status, applications(count)")
        if allowed is not None:
            query = query.in_("id", allowed[:MAX_OVERVIEW_JOBS])
        rows = query.limit(MAX_OVERVIEW_JOBS).execute().data or []
        lines = []
        for row in rows:
            counts = row.get("applications") or []
            count = counts[0].get("count", 0) if isinstance(counts, list) and counts else 0
            lines.append(f"- {row.get('job_title')} [{row.get('status')}]: {count} applications")
        return f"Role: {user.role}. Job postings visible ({len(rows)}):\n" + "\n".join(lines)
    except Exception as exc:  # noqa: BLE001 — tổng quan là tuỳ chọn
        logger.warning("workspace overview unavailable", extra={"error_type": type(exc).__name__})
        return ""


async def _candidate_access(candidate_uuid: str, user: AuthUser | None, settings: Settings) -> bool:
    """Cùng luật với mọi endpoint hồ sơ: HR tạo tin / tech lead trong hội đồng."""
    from modules.review.application.review_service import ReviewService
    from modules.review.infra.impl_supabase import SupabaseReviewRepo

    if user is None:
        return False
    client = get_supabase_admin_client(settings)
    if client is None:
        return False
    return await ReviewService(SupabaseReviewRepo(client)).may_access_candidate(
        candidate_uuid, user.id, user.role
    )


async def _stream_candidate_qa(
    request: AgentChatRequest, settings: Settings, user: AuthUser | None
) -> AsyncIterator[str]:
    """Chế độ hỏi đáp về ứng viên đang mở."""
    candidate_uuid = request.context.candidate_uuid or ""
    try:
        # 404 chứ không 403, cùng lý do với các endpoint hồ sơ khác.
        if not await _candidate_access(candidate_uuid, user, settings):
            yield _sse("error", {"message": "Candidate not found."})
            return
        yield _sse("status", {"message": "Reading the candidate's profile..."})
        client = get_supabase_admin_client(settings)
        role = user.role if user else "tech_lead"
        context = await asyncio.to_thread(load_candidate_context, client, candidate_uuid, role)
        yield _sse("status", {"message": "Agent is thinking..."})
        answer: CandidateAnswer = await asyncio.to_thread(
            answer_about_candidate,
            llm=_llm_provider(),
            context=context,
            lang=request.context.lang,
            message=request.message,
            history=request.turns(),
        )
        yield _sse(
            "done",
            {
                "conversation_id": str(request.conversation_id),
                "mode": "candidate",
                "result": {"summary": answer.answer, "candidates": [], "suggestions": answer.suggestions},
            },
        )
    except Exception as exc:
        logger.exception("Candidate Q&A failed", extra={"error_type": type(exc).__name__})
        yield _sse("error", {"message": _agent_error_message(exc)})


async def _stream_agent(
    request: AgentChatRequest, settings: Settings, user: AuthUser | None = None
) -> AsyncIterator[str]:
    if request.context.candidate_uuid:
        async for chunk in _stream_candidate_qa(request, settings, user):
            yield chunk
        return
    try:
        # Trả lời câu hỏi làm rõ: ghép tin trước với tin này thành một yêu cầu.
        prior = request.user_history() if request.clarification_reply else []
        criteria = request.initial_search_criteria
        if not prior:
            # Lượt đầu của một yêu cầu: hỏi bộ điều phối trước. "Xin chào" hay
            # "hệ thống chấm điểm thế nào" được trả lời ngay, không vào planner
            # để rồi bị hỏi ngược "bạn tuyển vị trí nào". Khi đang TRẢ LỜI câu
            # hỏi làm rõ (prior ≠ ∅) thì bỏ qua: "Senior Python, HCMC" đứng một
            # mình dễ bị xếp nhầm thành trò chuyện.
            yield _sse("status", {"message": "Understanding your request..."})
            overview = await asyncio.to_thread(_workspace_overview, settings, user)
            decision: OrchestratorDecision = await asyncio.to_thread(
                _orchestrator().classify,
                request.message,
                [f"{t.role}: {t.content}" for t in request.turns()],
                lang=request.context.lang,
                overview=overview,
            )
            if decision.intent == IntentType.GENERAL_CHAT:
                yield _sse(
                    "done",
                    {
                        "conversation_id": str(request.conversation_id),
                        "mode": "chat",
                        "result": {
                            "summary": decision.direct_response or "How can I help with your hiring?",
                            "candidates": [],
                            "suggestions": decision.suggestions[:3],
                        },
                    },
                )
                return
            criteria = decision.initial_search_criteria or criteria

        graph = _agent_graph(settings, user)
        objective = "\n".join([*prior, request.message]) if prior else request.message
        initial_state = ATSState(
            messages=[objective],
            initial_search_criteria=criteria,
            candidate_search=CandidateSearchState(
                mission=Mission(
                    objective=objective,
                    current_step="Planner Assessment",
                    status=MissionStatus.PENDING,
                )
            ),
        )

        yield _sse("status", {"message": "Agent is thinking..."})
        final_state = None
        try:
            async for update in graph.astream(initial_state, stream_mode="updates"):
                final_state = update
                for node_name in update:
                    yield _sse("status", {"message": f"Completed {node_name}"})
        except ClarificationNeeded as need:
            # Câu hỏi làm rõ là một LƯỢT TRẢ LỜI, không phải lỗi: client vẽ nó
            # như tin nhắn của agent và gửi câu trả lời ở request sau.
            yield _sse(
                "done",
                {
                    "conversation_id": str(request.conversation_id),
                    "mode": "search",
                    "result": {"summary": need.question, "candidates": []},
                    "clarification": True,
                },
            )
            return

        if not final_state:
            raise RuntimeError("Agent completed without a result")

        decision = _extract_final_decision(final_state)
        if decision is None:
            result = {"summary": "The agent completed without a recommendation.", "candidates": []}
        elif isinstance(decision, dict):
            result = RecruiterDecisionOutput.model_validate(decision).model_dump(mode="json")
        else:
            result = decision.model_dump(mode="json")

        yield _sse(
            "done",
            {"conversation_id": str(request.conversation_id), "mode": "search", "result": result},
        )
    except Exception as exc:
        logger.exception("Agent stream failed", extra={"error_type": type(exc).__name__})
        yield _sse("error", {"message": _agent_error_message(exc)})


@router.post("", response_class=StreamingResponse)
async def chat_with_agent(
    request: AgentChatRequest,
    _user: Annotated[AuthUser, Depends(require_operational_roles())],
    settings: Annotated[Settings, Depends(get_settings)],
    _limit: Annotated[None, Depends(agent_rate_limit)] = None,
) -> StreamingResponse:
    return StreamingResponse(
        _stream_agent(request, settings, _user),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


def route_after_planner(state: ATSState) -> str:
    """Điều hướng sau Planner: Chuyển sang Interaction nếu thiếu thông tin, ngược lại sang Retrieval."""
    query_assessment = state.candidate_search.query_assessment

    if not query_assessment or not query_assessment.clarification:
        return "retrieval"

    clarification = query_assessment.clarification

    # Nếu cần làm rõ thông tin từ người dùng
    if clarification.status == "not_enough":
        return "interaction"

    return "retrieval"


def route_after_reflection(state: ATSState) -> str:
    """Điều hướng sau Reflection: Thử lại (Planner) hoặc Chấp nhận (RecruiterDecision)."""
    reflection = state.candidate_search.reflection

    if reflection is None:
        return "recruiter"

    mission = state.candidate_search.mission

    # Chống vòng lặp vô hạn
    if reflection.retry and mission.retry_count < mission.max_retries and state.iteration < state.max_steps:
        return "planner"

    return "recruiter"