from abc import ABC, abstractmethod
from typing import Optional

from .models import ConfirmedSlot, Interviewer, SchedulingConfig


class ISchedulingRepo(ABC):
    @abstractmethod
    def get_interviewers(self) -> list[Interviewer]:
        ...

    @abstractmethod
    def get_interviewer(self, interviewer_id: str) -> Optional[Interviewer]:
        ...

    @abstractmethod
    def update_calendar_key(
        self, interviewer_id: str, api_key: str
    ) -> Optional[Interviewer]:
        ...

    @abstractmethod
    def save_confirmed_slot(self, slot: ConfirmedSlot) -> ConfirmedSlot:
        ...

    @abstractmethod
    def get_confirmed_slots(self, candidate_id: str) -> list[ConfirmedSlot]:
        ...

    @abstractmethod
    def get_config(self) -> SchedulingConfig:
        ...
