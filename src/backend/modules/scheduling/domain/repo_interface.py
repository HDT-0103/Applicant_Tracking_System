from abc import ABC, abstractmethod
from typing import Optional

from .models import CandidateContact, ConfirmedSlot, Interviewer, SchedulingConfig


class ISchedulingRepo(ABC):
    @abstractmethod
    def get_interviewers(self) -> list[Interviewer]:
        ...

    @abstractmethod
    def get_interviewer(self, interviewer_id: str) -> Optional[Interviewer]:
        ...

    @abstractmethod
    def update_calendar_key(
        self, interviewer_id: str, api_key: str, refresh_token: Optional[str] = None
    ) -> Optional[Interviewer]:
        ...

    @abstractmethod
    def get_candidate_email(self, candidate_id: str) -> Optional[str]:
        ...

    @abstractmethod
    def get_candidate_contact(self, candidate_id: str) -> Optional[CandidateContact]:
        """Tên + email ứng viên, lấy một lượt.

        Email chào hỏi bằng tên thì cần cả hai; hỏi riêng từng thứ là hai vòng
        khứ hồi cho cùng một dòng dữ liệu.
        """
        ...

    @abstractmethod
    def save_confirmed_slot(self, slot: ConfirmedSlot) -> ConfirmedSlot:
        ...

    @abstractmethod
    def get_confirmed_slots(self, candidate_id: str) -> list[ConfirmedSlot]:
        ...

    @abstractmethod
    def get_confirmed_slot(self, slot_id: str) -> Optional[ConfirmedSlot]:
        ...

    @abstractmethod
    def get_config(self) -> SchedulingConfig:
        ...
