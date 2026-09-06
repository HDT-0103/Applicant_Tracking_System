from datetime import datetime, timezone
from typing import Annotated, Optional
import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from modules.scheduling.application.scheduling_service import SchedulingService
from modules.scheduling.domain.errors import (
    CalendarUnavailableError,
    CandidateContactMissingError,
    NotificationNotSentError,
    SlotNotFoundError,
)
from modules.scheduling.domain.models import (
    ConfirmedSlot,
    Interviewer,
    TimeSlot,
)
from modules.scheduling.infra.google_calendar_service import GoogleCalendarService
from modules.scheduling.infra.calendar_event_service import CalendarEventService
from modules.scheduling.infra.email_notifier import EmailNotifier
from modules.scheduling.infra.slack_notifier import SlackNotifier
from modules.scheduling.infra.impl_supabase import SupabaseSchedulingRepo
from modules.scheduling.application.sweep_line_service import SweepLineService
from modules.shared.infrastructure.auth_dependencies import require_operational_roles, require_roles
from modules.auth.domain.models import AuthUser
from modules.review.adapters.routes import get_review_repo
from modules.review.application.review_service import ReviewService
from modules.review.domain.repo_interface import IReviewRepo
from modules.shared.infrastructure.config import Settings, get_settings
from modules.shared.infrastructure import audit
from modules.shared.infrastructure.audit import AuditDep, client_context
from modules.shared.infrastructure.supabase_client import get_supabase_client
from modules.scheduling.infra.google_oauth_service import GoogleOAuthService
from supabase import Client

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
    slack = SlackNotifier(app_timezone=settings.app_timezone)
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
ReviewRepoDep = Annotated[IReviewRepo, Depends(get_review_repo)]
SupabaseDep = Annotated[Client, Depends(get_supabase_admin_client)]


async def _require_candidate_access(
    review_repo: IReviewRepo, candidate_id: str, user: AuthUser
) -> None:
    """HR chỉ đặt lịch / gửi thư cho ứng viên nộp vào tin MÌNH tạo.

    Cùng câu hỏi với enrichment và review (`may_access_candidate`), hỏi qua
    cùng một repo. 404 chứ không 403: 403 xác nhận ứng viên đó tồn tại.
    """
    if not await ReviewService(repo=review_repo).may_access_candidate(
        candidate_id, user.id, user.role
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found.")


class SlotsQueryRequest(BaseModel):
    candidate_id: str = ""
    interviewer_ids: list[str]
    date_from: str
    date_to: str
    duration_minutes: Optional[int] = None
    limit: Optional[int] = 0


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


@router.get("/calendar-status")
async def calendar_status(
    service: ServiceDep,
    user: AuthUser = Depends(require_operational_roles()),
):
    """Check if the current user has a valid calendar connection"""
    interviewer = await service.get_interviewer(user.id)
    if not interviewer and user.email:
        all_interviewers = await service.list_interviewers()
        for iv in all_interviewers:
            if iv.email and iv.email.lower() == user.email.lower():
                interviewer = iv
                break

    connected = bool(
        interviewer
        and (interviewer.calendar_api_key or interviewer.calendar_refresh_token)
    )
    return {"connected": connected}


@router.get("/connected-interviewers")
async def list_connected_interviewers(
    service: ServiceDep,
    review_repo: ReviewRepoDep,
    supabase: SupabaseDep,
    candidate_id: Optional[str] = Query(None, description="Filter by candidate review panel"),
    user: AuthUser = Depends(require_operational_roles()),
    oauth_service: GoogleOAuthService = Depends(_build_oauth_service),
):
    """List all interviewers who have valid calendar connections for the candidate's review panel / HR company."""
    allowed_reviewer_ids: Optional[set[str]] = None

    if candidate_id and candidate_id != "00000000-0000-0000-0000-000000000000":
        await _require_candidate_access(review_repo, candidate_id, user)
        job_posting_id = await review_repo.job_posting_of_candidate(candidate_id)
        if job_posting_id:
            panel = await review_repo.get_panel(job_posting_id)
            allowed_reviewer_ids = {m.reviewer_id for m in panel}
            # Cho phép chính HR tham gia nếu cần
            allowed_reviewer_ids.add(user.id)
        else:
            allowed_reviewer_ids = set()
    elif user.role == "hr":
        hr_job_postings = await review_repo.job_postings_created_by(user.id)
        allowed_ids: set[str] = set()
        for jpid in hr_job_postings:
            panel = await review_repo.get_panel(jpid)
            allowed_ids.update(m.reviewer_id for m in panel)
        allowed_ids.add(user.id)

        # Fallback theo company_name nếu tin chưa gán hội đồng
        u_row = supabase.table("users").select("company_name").eq("id", user.id).execute()
        company_name = u_row.data[0].get("company_name") if u_row.data else None
        if company_name:
            c_users = supabase.table("users").select("id").eq("company_name", company_name).execute()
            for r in (c_users.data or []):
                allowed_ids.add(r["id"])

        allowed_reviewer_ids = allowed_ids

    all_interviewers = await service.list_interviewers()
    connected = []
    for iv in all_interviewers:
        if allowed_reviewer_ids is not None and iv.id not in allowed_reviewer_ids:
            continue
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
        raise HTTPException(status_code=400, detail="Failed to exchange the authorization code for a token")

    # Google chỉ trả refresh_token ở lần cấp quyền ĐẦU TIÊN. Những lần kết nối
    # lại sau đó chỉ có access_token, ghi đè thẳng sẽ xoá mất refresh_token cũ
    # và lịch của HR đó chết ngay khi access_token hết hạn sau 1 giờ.
    if not refresh_token:
        existing = await scheduling_service.get_interviewer(user.id)
        if existing and existing.calendar_refresh_token:
            refresh_token = existing.calendar_refresh_token

    await scheduling_service.update_calendar_key(user.id, access_token, refresh_token)
    return {"status": "success", "message": "Google Calendar connected successfully"}


class UpdateCalendarKeyRequest(BaseModel):
    api_key: str


@router.post("/calendar-key")
async def update_calendar_key(
    body: UpdateCalendarKeyRequest,
    scheduling_service: SchedulingService = Depends(_build_service),
    user: AuthUser = Depends(require_operational_roles()),
):
    """Cập nhật Google Calendar API Key trực tiếp"""
    key = body.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="API Key không được để trống")
    await scheduling_service.update_calendar_key(user.id, key)
    return {"status": "success", "message": "Google Calendar API Key updated successfully"}


@router.post("/slots", response_model=list[TimeSlot])
async def query_slots(
    body: SlotsQueryRequest,
    service: ServiceDep,
    review_repo: ReviewRepoDep,
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

    # Nếu date_to không có giờ cụ thể (00:00:00), mở rộng hết ngày đó (23:59:59)
    if date_to.hour == 0 and date_to.minute == 0 and date_to.second == 0:
        date_to = date_to.replace(hour=23, minute=59, second=59)

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

    if body.candidate_id and body.candidate_id != "00000000-0000-0000-0000-000000000000":
        await _require_candidate_access(review_repo, body.candidate_id, user)
        job_posting_id = await review_repo.job_posting_of_candidate(body.candidate_id)
        if job_posting_id:
            panel = await review_repo.get_panel(job_posting_id)
            allowed_panel_ids = {m.reviewer_id for m in panel}
            allowed_panel_ids.add(user.id)
            for iv_id in body.interviewer_ids:
                if iv_id not in allowed_panel_ids:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Interviewer {iv_id} is not in the review panel for this candidate's job posting",
                    )

    try:
        return await service.query_slots(
            interviewer_ids=body.interviewer_ids,
            date_from=date_from,
            date_to=date_to,
            duration_minutes=body.duration_minutes,
            limit=body.limit or 0,
        )
    except CalendarUnavailableError as exc:
        # 503 kèm TÊN người cần kết nối lại, không phải 500 trống rỗng. HR đọc
        # câu này là biết phải làm gì; trước đây họ chỉ thấy "Internal Server
        # Error" và không có cách nào đoán ra token của ai đã hết hạn.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                f"Could not read {exc.interviewer_name}'s calendar — their Google "
                "connection has expired. Ask them to reconnect it, then try again."
            ),
        )


async def _audit_slot(recorder, request, user, slot) -> None:
    """Ghi nhật ký xác nhận lịch: có tạo được sự kiện Google hay không là
    thông tin điều tra quan trọng nhất, nên ghi đúng cờ, không suy diễn."""
    if recorder is None:
        return
    ip, ua = client_context(request)
    await recorder.record(
        audit.SLOT_CONFIRM,
        user_id=user.id, candidate_uuid=slot.candidate_id, ip=ip, user_agent=ua,
        details={
            "slot_id": slot.id,
            "start_time": slot.start_time.isoformat() if hasattr(slot.start_time, "isoformat") else str(slot.start_time),
            "interviewer_ids": list(slot.interviewer_ids),
            "calendar_event_created": bool(slot.calendar_event_id),
            "slack_notified": bool(getattr(slot, "slack_notified", False)),
            "email_notified": bool(getattr(slot, "email_notified", False)),
        },
    )


@router.post("/confirm", response_model=ConfirmedSlot)
async def confirm_slot(
    body: ConfirmSlotRequest,
    service: ServiceDep,
    review_repo: ReviewRepoDep,
    user: AuthUser = Depends(require_roles("hr")),
    oauth_service: GoogleOAuthService = Depends(_build_oauth_service),
    request: Request = None,
    recorder: AuditDep = None,
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

    await _require_candidate_access(review_repo, body.candidate_id, user)

    job_posting_id = await review_repo.job_posting_of_candidate(body.candidate_id)
    if job_posting_id:
        panel = await review_repo.get_panel(job_posting_id)
        allowed_panel_ids = {m.reviewer_id for m in panel}
        allowed_panel_ids.add(user.id)
        for iv_id in body.interviewer_ids:
            if iv_id not in allowed_panel_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Interviewer {iv_id} is not in the review panel for this candidate's job posting",
                )

    interviewer = await service.get_interviewer(user.id)
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
        await _audit_slot(recorder, request, user, slot)
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
                await _audit_slot(recorder, request, user, slot)
                return slot
        raise e

class SendDetailsRequest(BaseModel):
    #: Bắt buộc: HR phải nhìn thấy đúng phòng và địa chỉ mình gửi đi. Trước
    #: đây cả hai đều có mặc định nên một request thiếu trường vẫn gửi cho ứng
    #: viên một địa chỉ do code bịa ra.
    room: str = Field(min_length=1, max_length=200)
    address: str = Field(min_length=1, max_length=500)


@router.post("/{slot_id}/send-details")
async def send_interview_details(
    slot_id: str,
    body: SendDetailsRequest,
    service: ServiceDep,
    review_repo: ReviewRepoDep,
    user: AuthUser = Depends(require_roles("hr")),
    request: Request = None,
    recorder: AuditDep = None,
):
    """Gửi phòng và địa chỉ phỏng vấn cho ứng viên — của lịch trong phạm vi mình."""
    slot = await service.get_confirmed_slot(slot_id)
    if slot is None:
        raise HTTPException(status_code=404, detail="Confirmed slot not found")
    await _require_candidate_access(review_repo, slot.candidate_id, user)
    try:
        email = await service.send_interview_details(
            slot_id=slot_id, room=body.room, address=body.address
        )
        if recorder is not None:
            ip, ua = client_context(request)
            await recorder.record(
                audit.INTERVIEW_DETAILS_SENT,
                user_id=user.id, candidate_uuid=slot.candidate_id, ip=ip, user_agent=ua,
                details={"slot_id": slot_id, "room": body.room},
            )
    except SlotNotFoundError:
        raise HTTPException(status_code=404, detail="Confirmed slot not found")
    except CandidateContactMissingError:
        raise HTTPException(
            status_code=400,
            detail="This candidate has no email address on file, so the details could not be sent.",
        )
    except NotificationNotSentError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Email is not configured on this server, so nothing was sent. "
                "Contact the candidate directly, or set SMTP_USERNAME / "
                "SMTP_PASSWORD (see docs/NOTIFICATIONS_SETUP.md)."
            ),
        )
    return {"status": "success", "message": f"Interview details sent to {email}"}
