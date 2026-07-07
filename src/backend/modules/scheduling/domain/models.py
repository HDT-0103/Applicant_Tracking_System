from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class Interviewer(BaseModel):
    id: str
    name: str
    email: str = ""
    role: str
    initials: str
    color: str
    cal_connected: bool = False
    calendar_api_key: Optional[str] = None
    calendar_id: str = "primary"


class FreeBusyInterval(BaseModel):
    interviewer_id: str
    start_time: datetime
    end_time: datetime


class TimeSlot(BaseModel):
    start_time: datetime
    end_time: datetime
    duration_min: float
    interviewer_ids: list[str]
    recommendation: str = ""


class ConfirmedSlot(BaseModel):
    id: str
    candidate_id: str
    start_time: datetime
    end_time: datetime
    interviewer_ids: list[str]
    calendar_event_id: Optional[str] = None
    slack_notified: bool = False
    email_notified: bool = False
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class SchedulingConfig(BaseModel):
    work_start: str = "07:30"
    work_end: str = "17:00"
    min_slot_minutes: int = 45
    default_range_days: int = 14
