from abc import ABC, abstractmethod
from pathlib import Path

from src.backend.app.agents.state import ATSState, ActionRecord

class BaseNode(ABC):
    @abstractmethod
    async def execute(self, state: ATSState) -> ATSState:
        """Thực thi logic chính của Node."""
        pass

    def load_prompt(self, filename: str) -> str:
        """Đọc file prompt, có thể cấu hình lại đường dẫn gốc sau này."""
        prompt_path = Path(__file__).resolve().parents[1] / filename
        with open(prompt_path, "r", encoding="utf-8") as file:
            return file.read()

    def record_action(self, state: ATSState, action: str, decision: str):
        """Ghi nhận action vào history chung của Agent."""
        state.iteration += 1
        state.candidate_search.action_history.append(
            ActionRecord(
                step=state.iteration,
                node_name=self.__class__.__name__,
                action=action,
                decision=decision,
            )
        )