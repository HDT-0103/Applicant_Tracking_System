from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog

from modules.scheduling.domain.models import FreeBusyInterval, TimeSlot

logger = structlog.get_logger(__name__)


class SweepLineService:
    def find_slots(
        self,
        interviewer_freebusy: dict[str, list[FreeBusyInterval]],
        min_slot_minutes: int = 45,
        limit: int = 5,
    ) -> list[TimeSlot]:
        if not interviewer_freebusy:
            return []

        all_interviewer_ids = set(interviewer_freebusy.keys())

        events: list[tuple[datetime, int, str]] = []
        for interviewer_id, intervals in interviewer_freebusy.items():
            for fb in intervals:
                events.append((fb.start_time, +1, interviewer_id))
                events.append((fb.end_time, -1, interviewer_id))

        events.sort(key=lambda x: (x[0], x[1]))

        active: set[str] = set()
        overlap_start: Optional[datetime] = None
        overlap_windows: list[tuple[datetime, datetime]] = []

        for ts, delta, iid in events:
            if delta == +1:
                active.add(iid)
                if len(active) == len(all_interviewer_ids):
                    overlap_start = ts
            else:
                if (
                    len(active) == len(all_interviewer_ids)
                    and overlap_start is not None
                ):
                    if ts > overlap_start:
                        overlap_windows.append((overlap_start, ts))
                    overlap_start = None
                active.discard(iid)

        if overlap_start is not None:
            now = datetime.now(timezone.utc)
            if now > overlap_start:
                overlap_windows.append((overlap_start, now))

        min_delta = timedelta(minutes=min_slot_minutes)
        filtered = []
        for start, end in overlap_windows:
            cursor = start.replace(second=0, microsecond=0)
            if cursor < start:
                cursor += timedelta(minutes=1)
            while cursor + min_delta <= end:
                slot_end = cursor + min_delta
                if slot_end > end:
                    slot_end = end
                duration = (slot_end - cursor).total_seconds() / 60
                filtered.append(
                    TimeSlot(
                        start_time=cursor,
                        end_time=slot_end,
                        duration_min=duration,
                        interviewer_ids=list(all_interviewer_ids),
                        recommendation=(
                            "Recommended"
                            if duration >= 60
                            else ""
                        ),
                    )
                )
                cursor += min_delta

        filtered.sort(
            key=lambda s: (-s.duration_min, s.start_time)
        )

        result = filtered

        logger.info(
            "scheduling.sweepline.complete",
            total_windows=len(overlap_windows),
            slots_found=len(result),
            min_slot_minutes=min_slot_minutes,
        )
        return result
