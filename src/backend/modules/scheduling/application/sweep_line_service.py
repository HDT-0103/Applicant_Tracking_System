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

        # No dangling-window handling here on purpose. Every interval pushes
        # both a +1 and a -1, so an overlap that opens always closes. The
        # previous code closed it at `datetime.now()`, which for future
        # availability would have produced a window ending in the past.

        min_delta = timedelta(minutes=min_slot_minutes)
        # Sorted once: `interviewer_ids` below is built from a set, and set
        # iteration order is not stable between processes. Unsorted, two
        # identical requests return different payloads — which breaks response
        # caching and makes any assertion on the field flaky.
        panel = sorted(all_interviewer_ids)
        filtered = []
        for start, end in overlap_windows:
            cursor = start.replace(second=0, microsecond=0)
            if cursor < start:
                cursor += timedelta(minutes=1)
            while cursor + min_delta <= end:
                # The loop condition already guarantees the slot fits, so no
                # clamping is needed and every slot is exactly min_slot_minutes.
                slot_end = cursor + min_delta
                duration = (slot_end - cursor).total_seconds() / 60
                filtered.append(
                    TimeSlot(
                        start_time=cursor,
                        end_time=slot_end,
                        duration_min=duration,
                        interviewer_ids=panel,
                        recommendation=(
                            "Recommended"
                            if duration >= 60
                            else ""
                        ),
                    )
                )
                cursor += timedelta(minutes=15)

        # Every slot is exactly min_slot_minutes long, so sorting by duration
        # first would be a no-op tie-break. Chronological order is what a
        # recruiter reading a list of suggestions actually expects.
        filtered.sort(key=lambda s: s.start_time)

        # limit <= 0 means no cap. We want to return all slots as requested.
        result = filtered

        logger.info(
            "scheduling.sweepline.complete",
            total_windows=len(overlap_windows),
            slots_found=len(result),
            min_slot_minutes=min_slot_minutes,
        )
        return result
