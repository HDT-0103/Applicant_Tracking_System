import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import structlog

from modules.scheduling.domain.models import (
    ConfirmedSlot,
    Interviewer,
    SchedulingConfig,
)
from modules.scheduling.domain.repo_interface import ISchedulingRepo

logger = structlog.get_logger(__name__)

DATA_DIR = "./stored_data"
os.makedirs(DATA_DIR, exist_ok=True)
INTERVIEWERS_FILE = os.path.join(DATA_DIR, "interviewers.json")
CONFIRMED_SLOTS_FILE = os.path.join(DATA_DIR, "confirmed_slots.json")


def _load_json(path: str, default: list | dict) -> list | dict:
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning("scheduling.json_load_failed", path=path, error=str(e))
    return default


def _save_json(path: str, data: list | dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)


SEED_INTERVIEWERS = [
    {
        "id": "interviewer-sarah-chen",
        "name": "Sarah Chen",
        "email": "cn20378@gmail.com",
        "role": "Staff Engineer",
        "initials": "SC",
        "color": "#6366F1",
        "cal_connected": True,
        "calendar_api_key": None,
        "calendar_id": "primary",
    },
    {
        "id": "interviewer-mike-park",
        "name": "Mike Park",
        "email": "mike.park@example.com",
        "role": "Tech Lead",
        "initials": "MP",
        "color": "#10B981",
        "cal_connected": True,
        "calendar_api_key": None,
        "calendar_id": "primary",
    },
    {
        "id": "interviewer-lisa-wong",
        "name": "Lisa Wong",
        "email": "lisa.wong@example.com",
        "role": "Engineering Manager",
        "initials": "LW",
        "color": "#F59E0B",
        "cal_connected": False,
        "calendar_api_key": None,
        "calendar_id": "primary",
    },
    {
        "id": "interviewer-david-kim",
        "name": "David Kim",
        "email": "david.kim@example.com",
        "role": "Senior Engineer",
        "initials": "DK",
        "color": "#EC4899",
        "cal_connected": False,
        "calendar_api_key": None,
        "calendar_id": "primary",
    },
]


class InMemorySchedulingRepo(ISchedulingRepo):
    def __init__(self) -> None:
        raw = _load_json(INTERVIEWERS_FILE, default=SEED_INTERVIEWERS)
        self._interviewers: dict[str, Interviewer] = {
            item["id"]: Interviewer(**item) for item in raw
        }
        raw_slots = _load_json(CONFIRMED_SLOTS_FILE, default=[])
        self._confirmed_slots: list[ConfirmedSlot] = [
            ConfirmedSlot(**item) for item in raw_slots
        ]
        logger.debug(
            "scheduling.repo.initialized",
            interviewer_count=len(self._interviewers),
            confirmed_count=len(self._confirmed_slots),
        )

    def _persist_interviewers(self) -> None:
        data = [m.model_dump(mode="json") for m in self._interviewers.values()]
        _save_json(INTERVIEWERS_FILE, data)

    def _persist_confirmed_slots(self) -> None:
        data = [m.model_dump(mode="json") for m in self._confirmed_slots]
        _save_json(CONFIRMED_SLOTS_FILE, data)

    def get_interviewers(self) -> list[Interviewer]:
        return list(self._interviewers.values())

    def get_interviewer(self, interviewer_id: str) -> Optional[Interviewer]:
        return self._interviewers.get(interviewer_id)

    def update_calendar_key(
        self, interviewer_id: str, api_key: str
    ) -> Optional[Interviewer]:
        interviewer = self._interviewers.get(interviewer_id)
        if not interviewer:
            logger.warning(
                "scheduling.repo.interviewer_not_found",
                interviewer_id=interviewer_id,
            )
            return None
        interviewer.calendar_api_key = api_key
        interviewer.cal_connected = bool(api_key)
        self._persist_interviewers()
        logger.info(
            "scheduling.repo.calendar_key_updated",
            interviewer_id=interviewer_id,
            connected=interviewer.cal_connected,
        )
        return interviewer

    def save_confirmed_slot(self, slot: ConfirmedSlot) -> ConfirmedSlot:
        self._confirmed_slots.append(slot)
        self._persist_confirmed_slots()
        logger.info(
            "scheduling.repo.slot_confirmed",
            slot_id=slot.id,
            candidate_id=slot.candidate_id,
        )
        return slot

    def get_confirmed_slots(self, candidate_id: str) -> list[ConfirmedSlot]:
        return [s for s in self._confirmed_slots if s.candidate_id == candidate_id]

    def get_config(self) -> SchedulingConfig:
        return SchedulingConfig()
