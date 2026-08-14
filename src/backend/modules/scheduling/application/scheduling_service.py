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

logger = structlog.get_logger(__name__)


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
    ) -> None:
        self._repo = repo
        self._calendar = calendar
        self._sweepline = sweepline
        self._slack = slack
        self._calendar_event = calendar_event
        self._email_notifier = email_notifier
        self._slack_webhook_url = slack_webhook_url

    async def list_interviewers(self) -> list[Interviewer]:
        return self._repo.get_interviewers()

    async def update_calendar_key(
        self, interviewer_id: str, api_key: str
    ) -> Optional[Interviewer]:
        return self._repo.update_calendar_key(interviewer_id, api_key)

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
            fbs = await self._calendar.fetch_freebusy(
                interviewer=interviewer,
                date_from=date_from,
                date_to=date_to,
                work_start=config.work_start,
                work_end=config.work_end,
                override_api_key=api_key,
            )
            if not fbs:
                start = date_from.replace(
                    hour=int(config.work_start.split(":")[0]),
                    minute=int(config.work_start.split(":")[1]),
                    second=0, microsecond=0,
                )
                end = date_to.replace(
                    hour=int(config.work_end.split(":")[0]),
                    minute=int(config.work_end.split(":")[1]),
                    second=0, microsecond=0,
                )
                fbs = [
                    FreeBusyInterval(
                        interviewer_id=interviewer.id,
                        start_time=max(
                            start, datetime.now(timezone.utc)
                        ),
                        end_time=end,
                    )
                ]
            freebusy_map[interviewer.id] = fbs

        slots = self._sweepline.find_slots(
            interviewer_freebusy=freebusy_map,
            min_slot_minutes=config.min_slot_minutes,
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

        slack_notified = await self._slack.notify(
            slot=slot,
            candidate_name=candidate_name,
            interviewers=interviewers,
            webhook_url=self._slack_webhook_url,
        )
        slot.slack_notified = slack_notified

        event_id = await self._calendar_event.create_event(
            api_key=api_key,
            summary=f"Interview: {candidate_name}",
            description=f"Scheduled interview with {candidate_name}",
            start_time=start_time,
            end_time=end_time,
            attendee_emails=[p.email for p in interviewers if p.email],
        )
        slot.calendar_event_id = event_id

        email_sent = await self._email_notifier.notify_interviewers(
            slot=slot,
            candidate_name=candidate_name,
            interviewers=interviewers,
        )
        slot.email_notified = email_sent

        return slot
