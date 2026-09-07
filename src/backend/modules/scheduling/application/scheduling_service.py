from datetime import datetime, timezone, timedelta
from typing import Optional

import structlog

from modules.scheduling.domain.errors import (
    CalendarUnavailableError,
    CandidateContactMissingError,
    NotificationNotSentError,
    SlotNotFoundError,
)
from modules.scheduling.domain.models import (
    ConfirmedSlot,
    FreeBusyInterval,
    Interviewer,
    TimeSlot,
)
from modules.scheduling.domain.repo_interface import ISchedulingRepo
from modules.scheduling.infra.google_calendar_service import GoogleCalendarService
from modules.scheduling.infra.calendar_event_service import CalendarEventService
from modules.scheduling.infra.email_notifier import EmailNotifier, to_local_tz
from modules.scheduling.infra.slack_notifier import SlackNotifier
from modules.scheduling.application.sweep_line_service import SweepLineService

from modules.scheduling.infra.google_oauth_service import GoogleOAuthService

logger = structlog.get_logger(__name__)

#: Default limit for slot suggestions (0 means no cap, return all available slots)
MAX_SUGGESTED_SLOTS = 0
def clip_to_future(
    freebusy_map: dict[str, list[FreeBusyInterval]], now: datetime
) -> dict[str, list[FreeBusyInterval]]:
    """Cắt mọi khoảng rảnh về sau `now`; khoảng đã qua hẳn thì bỏ."""
    clipped: dict[str, list[FreeBusyInterval]] = {}
    for interviewer_id, intervals in freebusy_map.items():
        kept = []
        for fb in intervals:
            if fb.end_time <= now:
                continue
            if fb.start_time < now:
                fb = fb.model_copy(update={"start_time": now})
            kept.append(fb)
        clipped[interviewer_id] = kept
    return clipped


#: Bước giữa hai gợi ý giờ bắt đầu trên trang lịch. 15 phút để HR chọn được
#: 9:15 hay 9:30 chứ không chỉ 9:00 / 9:45; các khe vì thế chồng nhau — đó là
#: gợi ý giờ bắt đầu, không phải lịch chia ca.
SLOT_STEP_MINUTES = 15


class SchedulingService:
    def __init__(
        self,
        repo: ISchedulingRepo,
        calendar: GoogleCalendarService,
        sweepline: SweepLineService,
        slack: SlackNotifier,
        calendar_event: CalendarEventService,
        email_notifier: EmailNotifier,
        slack_webhook_url: Optional[str] = None,
        oauth_service: Optional[GoogleOAuthService] = None,
    ) -> None:
        self._repo = repo
        self._calendar = calendar
        self._sweepline = sweepline
        self._slack = slack
        self._calendar_event = calendar_event
        self._email_notifier = email_notifier
        self._slack_webhook_url = slack_webhook_url
        self._oauth_service = oauth_service

    async def list_interviewers(self) -> list[Interviewer]:
        return self._repo.get_interviewers()

    async def get_interviewer(self, interviewer_id: str) -> Optional[Interviewer]:
        return self._repo.get_interviewer(interviewer_id)

    async def get_confirmed_slot(self, slot_id: str) -> Optional[ConfirmedSlot]:
        """Một lịch đã đặt — route dùng để biết lịch này của ứng viên nào
        trước khi cho gửi thư, vì HR chỉ được gửi cho ứng viên trong phạm vi."""
        return self._repo.get_confirmed_slot(slot_id)

    async def send_interview_details(
        self, slot_id: str, room: str, address: str
    ) -> str:
        """Gửi phòng và địa chỉ phỏng vấn cho ứng viên. Trả về email đã gửi tới.

        `room` và `address` do người gọi truyền vào, không có giá trị mặc định:
        trước đây cả route lẫn frontend đều tự điền "Conference Room A" nên HR
        có thể gửi đi một địa chỉ mà họ chưa từng nhìn thấy.
        """
        slot = self._repo.get_confirmed_slot(slot_id)
        if slot is None:
            raise SlotNotFoundError(slot_id)

        contact = self._repo.get_candidate_contact(slot.candidate_id)
        if contact is None:
            raise CandidateContactMissingError(slot.candidate_id)

        # Giờ địa phương chứ không phải UTC: ứng viên đọc thư rồi đi họp thật.
        local_start = to_local_tz(slot.start_time, self._email_notifier.timezone)
        slot_time = local_start.strftime("%A, %B %d, %Y at %I:%M %p (%Z)")

        sent = await self._email_notifier.send_room_details(
            candidate_name=contact.full_name,
            candidate_email=contact.email,
            slot_time=slot_time,
            room=room,
            address=address,
        )
        if not sent:
            # KHÔNG báo thành công cho việc chưa xảy ra. HR đọc câu "đã gửi"
            # rồi thôi không liên hệ ứng viên nữa; nếu thư không đi thì ứng
            # viên đến sai chỗ, hoặc không đến.
            logger.error(
                "scheduling.details_not_sent",
                slot_id=slot_id,
                candidate_id=slot.candidate_id,
            )
            raise NotificationNotSentError(contact.email)

        logger.info(
            "scheduling.details_sent", slot_id=slot_id, candidate_id=slot.candidate_id
        )
        return contact.email

    async def update_calendar_key(
        self, interviewer_id: str, api_key: str, refresh_token: Optional[str] = None
    ) -> Optional[Interviewer]:
        return self._repo.update_calendar_key(interviewer_id, api_key, refresh_token)

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    async def query_slots(
        self,
        interviewer_ids: list[str],
        date_from: datetime,
        date_to: datetime,
        api_key: str = "",
        duration_minutes: Optional[int] = None,
        limit: int = 0,
    ) -> list[TimeSlot]:
        config = self._repo.get_config()
        min_slot_minutes = duration_minutes or config.min_slot_minutes

        interviewers = self._repo.get_interviewers()
        selected = [p for p in interviewers if p.id in interviewer_ids]

        if not selected:
            logger.warning("scheduling.service.no_interviewers_selected")
            return []

        freebusy_map: dict[str, list] = {}
        for interviewer in selected:
            # 1. Đọc lịch bằng token của chính người đó.
            #
            # Bọc try/except vì `fetch_freebusy` NÉM khi Google trả 401, chứ
            # không trả về rỗng. Trước đây lỗi đó bay thẳng ra ngoài thành HTTP
            # 500, và nhánh làm mới token ngay bên dưới KHÔNG BAO GIỜ chạy tới
            # — token hết hạn là cả tính năng đặt lịch chết.
            try:
                fbs = await self._calendar.fetch_freebusy(
                    interviewer=interviewer,
                    date_from=date_from,
                    date_to=date_to,
                    work_start=config.work_start,
                    work_end=config.work_end,
                    override_api_key="",
                )
            except Exception as exc:
                logger.warning(
                    "scheduling.freebusy_failed",
                    interviewer_id=interviewer.id,
                    name=interviewer.name,
                    error=str(exc),
                )
                fbs = []

            # 2. If no free intervals returned or token expired, and interviewer has refresh token, try refreshing
            if not fbs and interviewer.calendar_refresh_token and self._oauth_service:
                logger.info(
                    "scheduling.token_refresh_attempt",
                    interviewer_id=interviewer.id,
                    name=interviewer.name,
                )
                new_token = await self._oauth_service.refresh_access_token(
                    interviewer.calendar_refresh_token
                )
                if new_token:
                    self._repo.update_calendar_key(
                        interviewer.id, new_token, interviewer.calendar_refresh_token
                    )
                    interviewer.calendar_api_key = new_token
                    try:
                        fbs = await self._calendar.fetch_freebusy(
                            interviewer=interviewer,
                            date_from=date_from,
                            date_to=date_to,
                            work_start=config.work_start,
                            work_end=config.work_end,
                            override_api_key=new_token,
                        )
                    except Exception as exc:
                        logger.warning(
                            "scheduling.freebusy_failed_after_refresh",
                            interviewer_id=interviewer.id,
                            error=str(exc),
                        )
                        fbs = []

            # 2b. Có kết nối lịch mà vẫn không đọc được -> DỪNG, đừng đoán.
            #
            # Nhánh dự phòng bên dưới (quy về giờ làm việc tiêu chuẩn) chỉ đúng
            # cho người CHƯA kết nối lịch. Áp nó cho người đã kết nối mà token
            # chết nghĩa là coi họ rảnh cả ngày — hệ thống sẽ đề xuất khe giờ
            # họ đang bận, đúng thứ SRS cấm ("zero false-positive overlaps").
            if not fbs and (interviewer.calendar_api_key or interviewer.calendar_refresh_token):
                logger.error(
                    "scheduling.calendar_unreadable",
                    interviewer_id=interviewer.id,
                    name=interviewer.name,
                )
                raise CalendarUnavailableError(interviewer.name)

            # 3. Fallback to standard working hours if interviewer has no calendar connected
            if not fbs:
                from modules.scheduling.infra.google_calendar_service import _working_hour_intervals

                working_wholes = _working_hour_intervals(
                    date_from, date_to, config.work_start, config.work_end
                )
                fbs = [
                    FreeBusyInterval(
                        interviewer_id=interviewer.id,
                        start_time=ws,
                        end_time=we,
                    )
                    for ws, we in working_wholes
                ]
            freebusy_map[interviewer.id] = fbs

        # Không gợi ý giờ đã qua. Bản dựng khung giờ theo ngày làm việc từng
        # bỏ mất `max(start, now)`: chọn "hôm nay" lúc 15h vẫn được đề nghị
        # 9:00 sáng nay, và xác nhận thì tạo một sự kiện trong quá khứ.
        freebusy_map = clip_to_future(freebusy_map, self._now())

        slots = self._sweepline.find_slots(
            interviewer_freebusy=freebusy_map,
            min_slot_minutes=min_slot_minutes,
            limit=limit,
            step_minutes=SLOT_STEP_MINUTES,
        )

        return slots

    async def confirm_slot(
        self,
        candidate_id: str,
        candidate_name: str,
        start_time: datetime,
        end_time: datetime,
        interviewer_ids: list[str],
        api_key: str = "",
    ) -> ConfirmedSlot:
        import uuid

        slot = ConfirmedSlot(
            id=str(uuid.uuid4()),
            candidate_id=candidate_id,
            start_time=start_time,
            end_time=end_time,
            interviewer_ids=interviewer_ids,
        )
        self._repo.save_confirmed_slot(slot)

        interviewers = [
            p for p in self._repo.get_interviewers()
            if p.id in interviewer_ids
        ]

        # Lấy email của ứng viên từ DB để gửi thông báo
        candidate_email = self._repo.get_candidate_email(candidate_id)

        slack_notified = await self._slack.notify(
            slot=slot,
            candidate_name=candidate_name,
            interviewers=interviewers,
            webhook_url=self._slack_webhook_url,
        )
        slot.slack_notified = slack_notified

        attendee_emails = [p.email for p in interviewers if p.email]
        if candidate_email:
            attendee_emails.append(candidate_email)

        created_event_ids = []
        for iv in interviewers:
            iv_key = iv.calendar_api_key
            if not iv_key and iv.calendar_refresh_token and self._oauth_service:
                new_key = await self._oauth_service.refresh_access_token(iv.calendar_refresh_token)
                if new_key:
                    self._repo.update_calendar_key(iv.id, new_key, iv.calendar_refresh_token)
                    iv.calendar_api_key = new_key
                    iv_key = new_key

            if iv_key:
                eid = await self._calendar_event.create_event(
                    api_key=iv_key,
                    summary=f"Interview: {candidate_name}",
                    description=f"SmartATS Interview with {candidate_name}\n\nNote: Meeting room and location details will be announced later.",
                    start_time=start_time,
                    end_time=end_time,
                    attendee_emails=attendee_emails,
                    timezone_str=self._email_notifier.timezone,
                )
                if eid:
                    created_event_ids.append(eid)

        if not created_event_ids and api_key:
            eid = await self._calendar_event.create_event(
                api_key=api_key,
                summary=f"Interview: {candidate_name}",
                description=f"SmartATS Interview with {candidate_name}\n\nNote: Meeting room and location details will be announced later.",
                start_time=start_time,
                end_time=end_time,
                attendee_emails=attendee_emails,
                timezone_str=self._email_notifier.timezone,
            )
            if eid:
                created_event_ids.append(eid)

        slot.calendar_event_id = created_event_ids[0] if created_event_ids else None

        email_sent = await self._email_notifier.notify_interviewers(
            slot=slot,
            candidate_name=candidate_name,
            interviewers=interviewers,
            candidate_email=candidate_email,
        )
        slot.email_notified = email_sent

        # GHI LẠI kết quả. Ba dòng gán ở trên chỉ sửa đối tượng trong bộ nhớ:
        # phản hồi HTTP trả về đúng, nhưng bảng `confirmed_slots` giữ nguyên
        # giá trị mặc định từ lúc insert. Hệ quả là `slack_notified` và
        # `email_notified` trong cơ sở dữ liệu LUÔN LUÔN false, kể cả khi thông
        # báo đã gửi thành công — và `calendar_event_id` luôn null, nên không
        # có cách nào tra ngược ra sự kiện lịch đã tạo.
        try:
            self._repo.update_slot_notifications(slot)
        except Exception as exc:
            # Cuộc phỏng vấn đã được chốt và thông báo đã đi. Ghi cờ hỏng là
            # sai sổ sách, không phải hỏng nghiệp vụ — đừng ném lỗi vào mặt HR.
            logger.error(
                "scheduling.notification_flags_not_saved",
                slot_id=slot.id,
                error=str(exc),
            )

        return slot
