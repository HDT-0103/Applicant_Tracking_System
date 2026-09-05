from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from typing import Annotated
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
from modules.search.infra.legacy_bridge import (
    CandidateSearchRepository,
    CandidateSearchService,
    EnrichmentRepository,
    RankingService,
)
from modules.shared.infrastructure.auth_dependencies import require_operational_roles
from modules.shared.infrastructure.config import Settings, get_settings
from modules.shared.infrastructure.rate_limit import agent_rate_limit
from modules.shared.infrastructure.supabase_client import get_supabase_admin_client
from pydantic import BaseModel, Field

from src.backend.app.agents.nodes.interaction import CLIInteractionGateway
from src.backend.app.agents.state import (
    ATSState,
    CandidateSearchState,
    RecruiterDecisionOutput,
    Mission,
    MissionStatus,
)
from src.backend.app.services.llm_provider import (
    FallbackLLMProvider,
    GroqProvider,
    HFProvider,
)
from src.backend.app.schemas.orchestrator import ChatResponse, ChatResponseType

router = APIRouter(prefix="/agents", tags=["agents"])
logger = logging.getLogger(__name__)


class AgentContext(BaseModel):
    current_page: str = Field(default="candidates_dashboard", max_length=100)
    user_id: str = Field(min_length=1, max_length=200)


class AgentChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)
    conversation_id: UUID
    context: AgentContext
    history: list[str] = Field(default_factory=list, max_length=20)
    initial_search_criteria: dict[str, object] | None = None


def _agent_graph(settings: Settings):
    # Import lazily because graph.py imports the route decision functions from
    # this module while the application is importing the router.
    from src.backend.app.agents.graph import build_graph

    client = get_supabase_admin_client(settings)
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent search is unavailable: the database is not configured.",
        )

    search_service = CandidateSearchService(
        search_repository=CandidateSearchRepository(client),
        enrichment_repository=EnrichmentRepository(client),
        embedding_service=get_embedding_service(),
        ranking_service=RankingService(),
    )
    return build_graph(
        llm_provider=FallbackLLMProvider(
            primary=GroqProvider(),
            fallback=HFProvider(),
        ),
        search_service=search_service,
        interaction_gateway=CLIInteractionGateway(),
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


async def _stream_agent(request: AgentChatRequest, settings: Settings) -> AsyncIterator[str]:
    try:
        graph = _agent_graph(settings)
        initial_state = ATSState(
            messages=[request.message],
            initial_search_criteria=request.initial_search_criteria,
            candidate_search=CandidateSearchState(
                mission=Mission(
                    objective=request.message,
                    current_step="Planner Assessment",
                    status=MissionStatus.PENDING,
                )
            ),
        )

        yield _sse("status", {"message": "Agent is thinking..."})
        final_state = None
        async for update in graph.astream(initial_state, stream_mode="updates"):
            final_state = update
            for node_name in update:
                yield _sse("status", {"message": f"Completed {node_name}"})

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
            ChatResponse(
                type=ChatResponseType.AGENT_EXECUTION,
                conversation_id=str(request.conversation_id),
                result=result,
            ).model_dump(mode="json"),
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
        _stream_agent(request, settings),
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