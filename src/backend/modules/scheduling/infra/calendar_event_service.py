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
        # Không có token thì KHÔNG có sự kiện. Trước đây chỗ này trả một uuid
        # giả và ghi vào `confirmed_slots.calendar_event_id`, nên màn hình báo
        # "đã tạo lịch" cho một lịch không tồn tại — 0/15 slot trên DB thật có
        # sự kiện Google nào đứng sau id đó.
        if not api_key:
            logger.warning("scheduling.calendar_event.no_key", summary=summary)
            return None

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
                resp = await client.post(EVENTS_URL, json=payload, headers=headers, params={"sendUpdates": "all"})
                resp.raise_for_status()
                data = resp.json()
                event_id = data.get("id")
                logger.info(
                    "scheduling.calendar_event.created",
                    event_id=event_id,
                    html_link=data.get("htmlLink"),
                )
                return event_id
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise e
            logger.error(
                "scheduling.calendar_event.failed",
                status_code=e.response.status_code,
                error=str(e)[:200],
                summary=summary,
            )
            return None
        except Exception as e:
            logger.error(
                "scheduling.calendar_event.failed",
                error=str(e)[:200],
                summary=summary,
            )
            return None
