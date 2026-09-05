from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from modules.auth.domain.models import AuthUser
from modules.shared.infrastructure.auth_dependencies import require_operational_roles
from modules.shared.infrastructure.config import Settings, get_settings
from modules.shared.infrastructure.rate_limit import agent_rate_limit
from src.backend.app.agents.router import AgentChatRequest, _agent_error_message, _sse, _stream_agent
from src.backend.app.schemas.orchestrator import (
    ChatResponse,
    ChatResponseType,
    IntentType,
    OrchestratorDecision,
)
from src.backend.app.services.llm_provider import FallbackLLMProvider, GroqProvider, HFProvider
from src.backend.app.services.orchestrator import OrchestratorService

router = APIRouter(prefix="/chat", tags=["chat"])


def _orchestrator(settings: Settings) -> OrchestratorService:
    return OrchestratorService(
        FallbackLLMProvider(primary=GroqProvider(), fallback=HFProvider())
    )


async def _stream_chat(
    request: AgentChatRequest,
    settings: Settings,
    user: AuthUser | None = None,
) -> AsyncIterator[str]:
    try:
        decision: OrchestratorDecision = await asyncio.to_thread(
            _orchestrator(settings).classify,
            request.message,
            request.history,
        )

        if decision.intent == IntentType.GENERAL_CHAT:
            yield _sse(
                "direct",
                ChatResponse(
                    type=ChatResponseType.DIRECT_CHAT,
                    conversation_id=str(request.conversation_id),
                    content=decision.direct_response
                    or "Tôi có thể giúp gì cho bạn về tuyển dụng?",
                ).model_dump(mode="json"),
            )
            return

        agent_request = request.model_copy(
            update={"initial_search_criteria": decision.initial_search_criteria}
        )
        yield _sse(
            "route",
            {
                "type": ChatResponseType.AGENT_EXECUTION.value,
                "message": "Agent is handling the candidate search.",
            },
        )
        async for event in _stream_agent(agent_request, settings, user):
            yield event
    except Exception as exc:
        yield _sse("error", {"message": _agent_error_message(exc)})


@router.post("")
async def chat(
    request: AgentChatRequest,
    _user: Annotated[AuthUser, Depends(require_operational_roles())],
    settings: Annotated[Settings, Depends(get_settings)],
    _limit: Annotated[None, Depends(agent_rate_limit)] = None,
) -> StreamingResponse:
    return StreamingResponse(
        _stream_chat(request, settings, _user),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
