from datetime import datetime, timezone, timedelta
from typing import Optional

import structlog

from modules.scheduling.domain.models import (
    ConfirmedSlot,
    FreeBusyInterval,
    Interviewer,
    TimeSlot,
)
from modules.scheduling.domain.repo_interface import ISchedulingRepo
from modules.scheduling.infra.google_calendar_service import GoogleCalendarService
from modules.scheduling.infra.calendar_event_service import CalendarEventService
from modules.scheduling.infra.email_notifier import EmailNotifier
from modules.scheduling.infra.slack_notifier import SlackNotifier
from modules.scheduling.application.sweep_line_service import SweepLineService

from modules.scheduling.infra.google_oauth_service import GoogleOAuthService

logger = structlog.get_logger(__name__)

#: How many slot suggestions the panel search returns at most.
MAX_SUGGESTED_SLOTS = 5


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

    async def update_calendar_key(
        self, interviewer_id: str, api_key: str, refresh_token: Optional[str] = None
    ) -> Optional[Interviewer]:
        return self._repo.update_calendar_key(interviewer_id, api_key, refresh_token)

    async def query_slots(
        self,
        interviewer_ids: list[str],
        date_from: datetime,
        date_to: datetime,
        api_key: str = "",
    ) -> list[TimeSlot]:
        config = self._repo.get_config()

        interviewers = self._repo.get_interviewers()
        selected = [p for p in interviewers if p.id in interviewer_ids]

        if not selected:
            logger.warning("scheduling.service.no_interviewers_selected")
            return []

        freebusy_map: dict[str, list] = {}
        for interviewer in selected:
            # 1. Attempt fetching freebusy using interviewer's own token
            fbs = await self._calendar.fetch_freebusy(
                interviewer=interviewer,
                date_from=date_from,
                date_to=date_to,
                work_start=config.work_start,
                work_end=config.work_end,
                override_api_key="",  # Always use interviewer's own calendar token
            )

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
                    fbs = await self._calendar.fetch_freebusy(
                        interviewer=interviewer,
                        date_from=date_from,
                        date_to=date_to,
                        work_start=config.work_start,
                        work_end=config.work_end,
                        override_api_key=new_token,
                    )

            # 3. Fallback to standard working hours if interviewer has no calendar connected
            if not fbs:
                start = date_from.replace(
                    hour=int(config.work_start.split(":")[0]),
                    minute=int(config.work_start.split(":")[1]),
                    second=0,
                    microsecond=0,
                )
                end = date_to.replace(
                    hour=int(config.work_end.split(":")[0]),
                    minute=int(config.work_end.split(":")[1]),
                    second=0,
                    microsecond=0,
                )
                fbs = [
                    FreeBusyInterval(
                        interviewer_id=interviewer.id,
                        start_time=max(start, datetime.now(timezone.utc)),
                        end_time=end,
                    )
                ]
            freebusy_map[interviewer.id] = fbs

        slots = self._sweepline.find_slots(
            interviewer_freebusy=freebusy_map,
            min_slot_minutes=config.min_slot_minutes,
            # Passed explicitly so the cap is visible here rather than hidden in
            # a default. `limit` used to be ignored entirely, so a free working
            # day returned every 45-minute block in it — the UI header reads
            # "Available Slots (N)", and N in the dozens is noise, not choice.
            # Raise this if recruiters ask for more options.
            limit=MAX_SUGGESTED_SLOTS,
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
                    description=f"SmartATS Interview with {candidate_name}",
                    start_time=start_time,
                    end_time=end_time,
                    attendee_emails=attendee_emails,
                )
                if eid:
                    created_event_ids.append(eid)

        if not created_event_ids and api_key:
            eid = await self._calendar_event.create_event(
                api_key=api_key,
                summary=f"Interview: {candidate_name}",
                description=f"SmartATS Interview with {candidate_name}",
                start_time=start_time,
                end_time=end_time,
                attendee_emails=attendee_emails,
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

        return slot
