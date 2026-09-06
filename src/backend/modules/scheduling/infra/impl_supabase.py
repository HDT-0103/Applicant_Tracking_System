import structlog
from typing import Optional
from datetime import datetime

from supabase import Client
from modules.scheduling.domain.models import (
    CandidateContact,
    ConfirmedSlot,
    Interviewer,
    SchedulingConfig,
)
from modules.scheduling.domain.repo_interface import ISchedulingRepo

logger = structlog.get_logger(__name__)

class SupabaseSchedulingRepo(ISchedulingRepo):
    def __init__(self, supabase_client: Client) -> None:
        self._supabase = supabase_client
        self._config = SchedulingConfig()
        logger.debug("scheduling.repo.supabase.initialized")

    def get_config(self) -> SchedulingConfig:
        return self._config

    def get_interviewers(self) -> list[Interviewer]:
        res = self._supabase.table("interviewers").select("*").execute()
        
        interviewers = []
        for row in res.data:
            iv = Interviewer(
                id=row["id"],
                name=row["name"],
                email=row.get("email", ""),
                role=row.get("job_title", ""),
                initials=row["initials"],
                color=row["color"],
                cal_connected=row.get("cal_connected", False),
                calendar_api_key=row.get("calendar_api_key"),
                calendar_refresh_token=row.get("calendar_refresh_token"),
                calendar_id=row.get("calendar_id", "primary")
            )
            interviewers.append(iv)
        return interviewers

    def get_interviewer(self, interviewer_id: str) -> Optional[Interviewer]:
        res = self._supabase.table("interviewers").select("*").eq("id", interviewer_id).execute()
        if not res.data:
            return None
        
        row = res.data[0]
        return Interviewer(
            id=row["id"],
            name=row["name"],
            email=row.get("email", ""),
            role=row.get("job_title", ""),
            initials=row["initials"],
            color=row["color"],
            cal_connected=row.get("cal_connected", False),
            calendar_api_key=row.get("calendar_api_key"),
            calendar_refresh_token=row.get("calendar_refresh_token"),
            calendar_id=row.get("calendar_id", "primary")
        )

    def update_calendar_key(
        self, interviewer_id: str, api_key: str, refresh_token: Optional[str] = None
    ) -> Optional[Interviewer]:
        
        update_data = {
            "calendar_api_key": api_key,
            "cal_connected": bool(api_key),
            "updated_at": datetime.utcnow().isoformat()
        }
        if refresh_token:
            update_data["calendar_refresh_token"] = refresh_token

        res = self._supabase.table("interviewers").update(update_data).eq("id", interviewer_id).execute()
        if not res.data:
            user_row = self._supabase.table("users").select("name, email").eq("id", interviewer_id).execute()
            name = user_row.data[0]["name"] if user_row.data else "Interviewer"
            email = user_row.data[0]["email"] if user_row.data else ""
            insert_data = {
                "id": interviewer_id,
                "name": name,
                "email": email,
                "job_title": "Interviewer",
                "initials": (name[:2] if name else "IN").upper(),
                "color": "#6366F1",
                "calendar_id": "primary",
                **update_data
            }
            res = self._supabase.table("interviewers").insert(insert_data).execute()
        
        if res.data:
            return self.get_interviewer(interviewer_id)
        return None

    def get_candidate_contact(self, candidate_id: str) -> Optional[CandidateContact]:
        res = (
            self._supabase.table("candidates")
            .select("full_name, email")
            .eq("uuid", candidate_id)
            .execute()
        )
        if not res.data:
            return None

        row = res.data[0]
        email = row.get("email")
        if not email:
            return None

        return CandidateContact(
            candidate_id=candidate_id,
            full_name=row.get("full_name") or "Candidate",
            email=email,
        )

    def get_candidate_email(self, candidate_id: str) -> Optional[str]:
        res = self._supabase.table("candidates").select("email").eq("uuid", candidate_id).execute()
        if res.data and len(res.data) > 0:
            return res.data[0].get("email")
        return None

    def save_confirmed_slot(self, slot: ConfirmedSlot) -> ConfirmedSlot:
        self._supabase.table("confirmed_slots").insert({
            "id": slot.id,
            "candidate_uuid": slot.candidate_id,
            "start_time": slot.start_time.isoformat(),
            "end_time": slot.end_time.isoformat(),
            "interviewer_ids": slot.interviewer_ids,
            "calendar_event_id": slot.calendar_event_id,
            "slack_notified": slot.slack_notified,
            "email_notified": slot.email_notified,
            "created_at": slot.created_at
        }).execute()

        return slot

    def update_slot_notifications(self, slot: ConfirmedSlot) -> None:
        self._supabase.table("confirmed_slots").update({
            "calendar_event_id": slot.calendar_event_id,
            "slack_notified": slot.slack_notified,
            "email_notified": slot.email_notified,
        }).eq("id", slot.id).execute()

    def get_confirmed_slot(self, slot_id: str) -> Optional[ConfirmedSlot]:
        res = (
            self._supabase.table("confirmed_slots")
            .select("*")
            .eq("id", slot_id)
            .execute()
        )
        if not res.data:
            return None
        return self._to_slot(res.data[0])

    @staticmethod
    def _to_slot(row: dict) -> ConfirmedSlot:
        return ConfirmedSlot(
            id=row["id"],
            candidate_id=row["candidate_uuid"],
            start_time=datetime.fromisoformat(row["start_time"]),
            end_time=datetime.fromisoformat(row["end_time"]),
            interviewer_ids=row.get("interviewer_ids", []),
            calendar_event_id=row.get("calendar_event_id"),
            slack_notified=row.get("slack_notified", False),
            email_notified=row.get("email_notified", False),
            created_at=row.get("created_at"),
        )

    def get_confirmed_slots(self, candidate_id: str) -> list[ConfirmedSlot]:
        res = self._supabase.table("confirmed_slots").select("*").eq("candidate_uuid", candidate_id).execute()
        return [self._to_slot(row) for row in res.data or []]
