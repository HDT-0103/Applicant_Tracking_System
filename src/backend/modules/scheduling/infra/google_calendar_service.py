from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
import structlog

from modules.scheduling.domain.models import FreeBusyInterval, Interviewer

logger = structlog.get_logger(__name__)

FREE_BUSY_BASE = "https://www.googleapis.com/calendar/v3/freeBusy"

WEEKDAYS = frozenset(range(5))


def _working_hour_intervals(
    date_from: datetime, date_to: datetime, work_start: str, work_end: str
) -> list[tuple[datetime, datetime]]:
    intervals: list[tuple[datetime, datetime]] = []
    current = date_from.replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = date_to.replace(hour=0, minute=0, second=0, microsecond=0)
    while current <= end_date:
        if current.weekday() in WEEKDAYS:
            ws_h, ws_m = map(int, work_start.split(":"))
            we_h, we_m = map(int, work_end.split(":"))
            day_start = current.replace(hour=ws_h, minute=ws_m)
            day_end = current.replace(hour=we_h, minute=we_m)
            intervals.append((day_start, day_end))
        current += timedelta(days=1)
    return intervals


def _intersect_intervals(
    free_intervals: list[tuple[datetime, datetime]],
    working_intervals: list[tuple[datetime, datetime]],
) -> list[tuple[datetime, datetime]]:
    result: list[tuple[datetime, datetime]] = []
    fi = 0
    wi = 0
    while fi < len(free_intervals) and wi < len(working_intervals):
        start = max(free_intervals[fi][0], working_intervals[wi][0])
        end = min(free_intervals[fi][1], working_intervals[wi][1])
        if start < end:
            result.append((start, end))
        if free_intervals[fi][1] < working_intervals[wi][1]:
            fi += 1
        else:
            wi += 1
    return result


class GoogleCalendarService:
    def __init__(self, http_client: Optional[httpx.AsyncClient] = None) -> None:
        self._client = http_client or httpx.AsyncClient(timeout=15.0)

    async def fetch_freebusy(
        self,
        interviewer: Interviewer,
        date_from: datetime,
        date_to: datetime,
        work_start: str = "07:30",
        work_end: str = "17:00",
        override_api_key: str = "",
    ) -> list[FreeBusyInterval]:
        key = override_api_key or interviewer.calendar_api_key
        if not key:
            logger.info(
                "scheduling.google.no_api_key",
                interviewer_id=interviewer.id,
                name=interviewer.name,
            )
            return []

        token_type = "OAuth" if key.startswith("ya29.") else "APIKey"
        logger.info(
            "scheduling.google.using_key",
            interviewer_id=interviewer.id,
            name=interviewer.name,
            token_type=token_type,
        )

        is_oauth_token = key.startswith("ya29.")
        if is_oauth_token:
            freebusy_url = FREE_BUSY_BASE
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {key}",
            }
        else:
            freebusy_url = f"{FREE_BUSY_BASE}?key={key}"
            headers = {"Content-Type": "application/json"}
        payload = {
            "timeMin": date_from.isoformat(),
            "timeMax": date_to.isoformat(),
            "items": [{"id": interviewer.calendar_id}],
        }

        try:
            resp = await self._client.post(
                freebusy_url, json=payload, headers=headers
            )
            if resp.status_code == 401 or resp.status_code == 403:
                logger.error(
                    "scheduling.google.auth_failed",
                    interviewer_id=interviewer.id,
                    name=interviewer.name,
                    status=resp.status_code,
                    body=resp.text[:500],
                )
                return []
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.error(
                "scheduling.google.fetch_failed",
                interviewer_id=interviewer.id,
                name=interviewer.name,
                error=str(e),
            )
            return []

        cal_data = data.get("calendars", {}).get(interviewer.calendar_id, {})
        raw_busy = cal_data.get("busy", [])

        busy_intervals = []
        for entry in raw_busy:
            start = datetime.fromisoformat(entry["start"])
            end = datetime.fromisoformat(entry["end"])
            busy_intervals.append((start, end))
        busy_intervals.sort(key=lambda x: x[0])

        working_wholes = _working_hour_intervals(
            date_from, date_to, work_start, work_end
        )

        free_slots: list[tuple[datetime, datetime]] = []
        for ws, we in working_wholes:
            cursor = ws
            for bs, be in busy_intervals:
                if be <= cursor:
                    continue
                if bs >= we:
                    break
                if bs > cursor:
                    free_slots.append((cursor, bs))
                cursor = max(cursor, be)
            if cursor < we:
                free_slots.append((cursor, we))

        result = [
            FreeBusyInterval(
                interviewer_id=interviewer.id,
                start_time=start,
                end_time=end,
            )
            for start, end in free_slots
        ]

        logger.info(
            "scheduling.google.fetch_complete",
            interviewer_id=interviewer.id,
            free_windows=len(result),
        )
        return result
