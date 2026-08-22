from datetime import datetime, timezone
from typing import Annotated, Optional
import httpx
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
from modules.scheduling.infra.email_notifier import EmailNotifier, to_local_tz
from modules.scheduling.infra.slack_notifier import SlackNotifier
from modules.scheduling.infra.impl_supabase import SupabaseSchedulingRepo
from modules.scheduling.application.sweep_line_service import SweepLineService
from modules.shared.infrastructure.auth_dependencies import require_operational_roles, require_roles
from modules.auth.domain.models import AuthUser
from modules.shared.infrastructure.config import Settings, get_settings
from modules.shared.infrastructure.supabase_client import get_supabase_client
from modules.scheduling.infra.google_oauth_service import GoogleOAuthService

router = APIRouter(prefix="/api/scheduling", tags=["scheduling"])
logger = structlog.get_logger(__name__)

def _build_oauth_service(settings: Settings = Depends(get_settings)) -> GoogleOAuthService:
    return GoogleOAuthService(
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        redirect_uri=settings.google_redirect_uri
    )


def _build_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> SchedulingService:
    repo = SupabaseSchedulingRepo(get_supabase_client(settings, use_admin=True))
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
        app_timezone=settings.app_timezone,
    )
    oauth_service = GoogleOAuthService(
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        redirect_uri=settings.google_redirect_uri,
    )
    return SchedulingService(
        repo=repo,
        calendar=calendar,
        sweepline=sweepline,
        slack=slack,
        calendar_event=calendar_event,
        email_notifier=email_notifier,
        slack_webhook_url=settings.slack_webhook_url or None,
        oauth_service=oauth_service,
    )


ServiceDep = Annotated[SchedulingService, Depends(_build_service)]


class UpdateKeyRequest(BaseModel):
    api_key: str
    refresh_token: str | None = None


class SlotsQueryRequest(BaseModel):
    candidate_id: str = ""
    interviewer_ids: list[str]
    date_from: str
    date_to: str


class ConfirmSlotRequest(BaseModel):
    candidate_id: str
    candidate_name: str = ""
    start_time: str
    end_time: str
    interviewer_ids: list[str]


class GoogleAuthCallbackRequest(BaseModel):
    code: str


# ---- Endpoints ----


@router.get("/interviewers", response_model=list[Interviewer])
async def list_interviewers(
    service: ServiceDep,
    _user: Annotated[AuthUser, Depends(require_operational_roles())],
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
    _user: Annotated[AuthUser, Depends(require_operational_roles())],
) -> Interviewer:
    result = await service.update_calendar_key(interviewer_id, body.api_key, body.refresh_token)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Interviewer '{interviewer_id}' not found",
        )
    return result


@router.get("/calendar-status")
async def calendar_status(
    service: ServiceDep,
    user: AuthUser = Depends(require_operational_roles()),
):
    """Check if the current user has a valid calendar connection"""
    interviewer = service._repo.get_interviewer(user.id)
    connected = bool(
        interviewer
        and (interviewer.calendar_api_key or interviewer.calendar_refresh_token)
    )
    return {"connected": connected}


@router.get("/connected-interviewers")
async def list_connected_interviewers(
    service: ServiceDep,
    user: AuthUser = Depends(require_operational_roles()),
    oauth_service: GoogleOAuthService = Depends(_build_oauth_service),
):
    """List all interviewers who have valid calendar connections."""
    all_interviewers = await service.list_interviewers()
    connected = []
    for iv in all_interviewers:
        if iv.calendar_api_key or iv.calendar_refresh_token:
            if not iv.calendar_api_key and iv.calendar_refresh_token:
                new_token = await oauth_service.refresh_access_token(iv.calendar_refresh_token)
                if new_token:
                    await service.update_calendar_key(iv.id, new_token, iv.calendar_refresh_token)
                    iv.calendar_api_key = new_token
            if iv.calendar_api_key:
                connected.append(iv)
    return connected


@router.get("/auth/google/url")
async def get_google_auth_url(
    oauth_service: GoogleOAuthService = Depends(_build_oauth_service),
    _user: AuthUser = Depends(require_operational_roles()),
):
    """Lấy URL để Frontend mở cửa sổ đăng nhập Google"""
    return {"url": oauth_service.get_authorization_url()}


@router.post("/auth/google/callback")
async def google_auth_callback(
    body: GoogleAuthCallbackRequest,
    oauth_service: GoogleOAuthService = Depends(_build_oauth_service),
    scheduling_service: SchedulingService = Depends(_build_service),
    user: AuthUser = Depends(require_operational_roles()),
):
    """Receive code from Frontend, exchange for tokens and save to DB"""
    access_token, refresh_token = await oauth_service.exchange_code(body.code)
    if not access_token:
        raise HTTPException(status_code=400, detail="Failed to exchange code for tokens")

    # If Google did not return a new refresh token, preserve the existing one in DB
    existing_iv = scheduling_service._repo.get_interviewer(user.id)
    if not refresh_token and existing_iv and existing_iv.calendar_refresh_token:
        refresh_token = existing_iv.calendar_refresh_token

    await scheduling_service.update_calendar_key(user.id, access_token, refresh_token)
    return {"status": "success", "message": "Google Calendar connected successfully"}


@router.post("/slots", response_model=list[TimeSlot])
async def query_slots(
    body: SlotsQueryRequest,
    service: ServiceDep,
    user: AuthUser = Depends(require_roles("hr")),
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

    return await service.query_slots(
        interviewer_ids=body.interviewer_ids,
        date_from=date_from,
        date_to=date_to,
    )


@router.post("/confirm", response_model=ConfirmedSlot)
async def confirm_slot(
    body: ConfirmSlotRequest,
    service: ServiceDep,
    user: AuthUser = Depends(require_roles("hr")),
    oauth_service: GoogleOAuthService = Depends(_build_oauth_service),
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

    if not body.candidate_id or body.candidate_id == "00000000-0000-0000-0000-000000000000":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid candidate must be selected for scheduling. Please select a candidate from the dashboard.",
        )

    interviewer = service._repo.get_interviewer(user.id)
    api_key = interviewer.calendar_api_key if interviewer and interviewer.calendar_api_key else ""
    refresh_token = interviewer.calendar_refresh_token if interviewer else None

    try:
        slot = await service.confirm_slot(
            candidate_id=body.candidate_id,
            candidate_name=body.candidate_name,
            start_time=start_time,
            end_time=end_time,
            interviewer_ids=body.interviewer_ids,
            api_key=api_key,
        )
        return slot
    except Exception as e:
        is_401 = "401" in str(e) or (isinstance(e, httpx.HTTPStatusError) and e.response.status_code == 401)
        if is_401 and refresh_token:
            new_access_token = await oauth_service.refresh_access_token(refresh_token)
            if new_access_token:
                await service.update_calendar_key(user.id, new_access_token, refresh_token)
                slot = await service.confirm_slot(
                    candidate_id=body.candidate_id,
                    candidate_name=body.candidate_name,
                    start_time=start_time,
                    end_time=end_time,
                    interviewer_ids=body.interviewer_ids,
                    api_key=new_access_token,
                )
                return slot
        raise e

class SendDetailsRequest(BaseModel):
    room: str = ""
    address: str = ""

@router.post("/{slot_id}/send-details")
async def send_interview_details(
    slot_id: str,
    body: SendDetailsRequest,
    service: ServiceDep,
    _user: AuthUser = Depends(require_roles("hr")),
):
    """Send room and location details to candidate via email"""
    res = service._repo._supabase.table("confirmed_slots").select("*").eq("id", slot_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Confirmed slot not found")
    slot_row = res.data[0]

    cand_id = slot_row["candidate_uuid"]
    cand_res = service._repo._supabase.table("candidates").select("full_name, email").eq("uuid", cand_id).execute()
    if not cand_res.data or not cand_res.data[0].get("email"):
        raise HTTPException(status_code=400, detail="Candidate email not found")

    cand_name = cand_res.data[0].get("full_name") or "Candidate"
    cand_email = cand_res.data[0].get("email")

    start_dt = datetime.fromisoformat(slot_row["start_time"])
    local_start = to_local_tz(start_dt, service._email_notifier._app_timezone)
    slot_time = local_start.strftime("%A, %B %d, %Y at %I:%M %p (GMT+7)")

    room = body.room or "Conference Room A - 3rd Floor"
    address = body.address or "SmartATS HQ, 123 Tech Blvd"

    await service._email_notifier.send_room_details(
        candidate_name=cand_name,
        candidate_email=cand_email,
        slot_time=slot_time,
        room=room,
        address=address,
    )
    return {"status": "success", "message": "Interview room and location details sent to candidate successfully"}
