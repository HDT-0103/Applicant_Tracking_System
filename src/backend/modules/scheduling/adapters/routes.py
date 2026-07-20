from datetime import datetime, timezone
from typing import Annotated, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from modules.scheduling.application.scheduling_service import SchedulingService
from modules.scheduling.domain.models import (
    ConfirmedSlot,
    Interviewer,
    TimeSlot,
)
from modules.scheduling.infra.google_calendar_service import GoogleCalendarService
from modules.scheduling.infra.calendar_event_service import CalendarEventService
from modules.scheduling.infra.email_notifier import EmailNotifier
from modules.scheduling.infra.slack_notifier import SlackNotifier
from modules.scheduling.infra.impl_inmemory import InMemorySchedulingRepo
from modules.scheduling.application.sweep_line_service import SweepLineService
from modules.shared.infrastructure.auth_dependencies import require_roles
from modules.auth.domain.models import AuthUser
from modules.shared.infrastructure.config import Settings, get_settings

router = APIRouter(prefix="/api/scheduling", tags=["scheduling"])
logger = structlog.get_logger(__name__)


def _build_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> SchedulingService:
    repo = InMemorySchedulingRepo()
    calendar = GoogleCalendarService()
    sweepline = SweepLineService()
    slack = SlackNotifier()
    calendar_event = CalendarEventService()
    email_notifier = EmailNotifier(
        smtp_host=settings.smtp_host,
        smtp_port=settings.smtp_port,
        smtp_username=settings.smtp_username,
        smtp_password=settings.smtp_password,
        from_email=settings.smtp_from_email,
    )
    return SchedulingService(
        repo=repo,
        calendar=calendar,
        sweepline=sweepline,
        slack=slack,
        calendar_event=calendar_event,
        email_notifier=email_notifier,
        slack_webhook_url=settings.slack_webhook_url or None,
    )


ServiceDep = Annotated[SchedulingService, Depends(_build_service)]


class UpdateKeyRequest(BaseModel):
    api_key: str


class SlotsQueryRequest(BaseModel):
    candidate_id: str = ""
    interviewer_ids: list[str]
    date_from: str
    date_to: str
    api_key: str = ""


class ConfirmSlotRequest(BaseModel):
    candidate_id: str
    candidate_name: str = ""
    start_time: str
    end_time: str
    interviewer_ids: list[str]
    api_key: str = ""


# ---- Endpoints ----


@router.get("/interviewers", response_model=list[Interviewer])
async def list_interviewers(
    service: ServiceDep,
    _user: Annotated[AuthUser, Depends(require_roles("hr", "admin"))],
) -> list[Interviewer]:
    return await service.list_interviewers()


@router.put(
    "/interviewers/{interviewer_id}/calendar-key",
    response_model=Interviewer,
)
async def update_calendar_key(
    interviewer_id: str,
    body: UpdateKeyRequest,
    service: ServiceDep,
    _user: Annotated[AuthUser, Depends(require_roles("hr", "admin"))],
) -> Interviewer:
    result = await service.update_calendar_key(interviewer_id, body.api_key)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interviewer '{interviewer_id}' not found",
        )
    return result


@router.post("/slots", response_model=list[TimeSlot])
async def query_slots(
    body: SlotsQueryRequest,
    service: ServiceDep,
    _user: Annotated[AuthUser, Depends(require_roles("hr", "admin"))],
) -> list[TimeSlot]:
    try:
        date_from = datetime.fromisoformat(body.date_from)
        date_to = datetime.fromisoformat(body.date_to)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format: {e}",
        )

    if date_from.tzinfo is None:
        date_from = date_from.replace(tzinfo=timezone.utc)
    if date_to.tzinfo is None:
        date_to = date_to.replace(tzinfo=timezone.utc)

    if date_from >= date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="date_from must be before date_to",
        )

    if not body.interviewer_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one interviewer_id is required",
        )

    slots = await service.query_slots(
        interviewer_ids=body.interviewer_ids,
        date_from=date_from,
        date_to=date_to,
        api_key=body.api_key,
    )
    return slots


@router.post("/confirm", response_model=ConfirmedSlot)
async def confirm_slot(
    body: ConfirmSlotRequest,
    service: ServiceDep,
    _user: Annotated[AuthUser, Depends(require_roles("hr", "admin"))],
) -> ConfirmedSlot:
    try:
        start_time = datetime.fromisoformat(body.start_time)
        end_time = datetime.fromisoformat(body.end_time)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid datetime format: {e}",
        )

    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=timezone.utc)

    if start_time >= end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_time must be before end_time",
        )

    if not body.interviewer_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one interviewer_id is required",
        )

    slot = await service.confirm_slot(
        candidate_id=body.candidate_id,
        candidate_name=body.candidate_name,
        start_time=start_time,
        end_time=end_time,
        interviewer_ids=body.interviewer_ids,
        api_key=body.api_key,
    )
    return slot
