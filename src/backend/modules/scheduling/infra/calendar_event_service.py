import uuid
from datetime import datetime
from typing import Optional

import httpx
import structlog

logger = structlog.get_logger(__name__)

EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"


class CalendarEventService:
    async def create_event(
        self,
        api_key: str,
        summary: str,
        description: str,
        start_time: datetime,
        end_time: datetime,
        attendee_emails: list[str],
    ) -> Optional[str]:
        if not api_key:
            fake_id = str(uuid.uuid4())
            logger.info(
                "scheduling.calendar_event.mock_no_key",
                event_id=fake_id,
                summary=summary,
            )
            return fake_id

        payload = {
            "summary": summary,
            "description": description,
            "start": {
                "dateTime": start_time.isoformat(),
                "timeZone": "UTC",
            },
            "end": {
                "dateTime": end_time.isoformat(),
                "timeZone": "UTC",
            },
            "attendees": [{"email": email} for email in attendee_emails if email],
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "email", "minutes": 24 * 60},
                    {"method": "popup", "minutes": 30},
                ],
            },
        }

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(EVENTS_URL, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                event_id = data.get("id")
                logger.info(
                    "scheduling.calendar_event.created",
                    event_id=event_id,
                    html_link=data.get("htmlLink"),
                )
                return event_id
        except Exception as e:
            fake_id = str(uuid.uuid4())
            logger.info(
                "scheduling.calendar_event.mock_fallback",
                event_id=fake_id,
                error=str(e),
                summary=summary,
            )
            return fake_id
