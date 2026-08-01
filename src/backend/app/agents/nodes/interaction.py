from abc import ABC, abstractmethod
import asyncio

from backend.app.agents.nodes.base import BaseNode
from backend.app.agents.state import ATSState


class HumanInteractionGateway(ABC):
    """Abstraction để giao tiếp với User (CLI, REST, WebSocket...)"""
    @abstractmethod
    async def ask(self, question: str) -> str:
        pass

class CLIInteractionGateway(HumanInteractionGateway):
    async def ask(self, question: str) -> str:
        print(f"\n[ATS Assistant]\n{question}")
        return (await asyncio.to_thread(input, "\nYour response: ")).strip()


class InteractionNode(BaseNode):
    def __init__(self, gateway: HumanInteractionGateway):
        super().__init__()
        self.gateway = gateway

    async def execute(self, state: ATSState) -> ATSState:
        if not state.candidate_search.query_assessment:
            self.record_action(
                state=state,
                action="Ask User for Clarification",
                decision="Skipped - no query assessment",
            )
            return state

        clarification = state.candidate_search.query_assessment.clarification
        question = clarification.question or (
            f"Bạn có thể bổ sung: {', '.join(clarification.missing_fields)}?"
            if clarification.missing_fields
            else None
        )

        if not question:
            self.record_action(
                state=state,
                action="Ask User for Clarification",
                decision="Skipped - no clarification question",
            )
            return state
        
        # Gọi Gateway thay vì dùng input() trực tiếp
        answer = await self.gateway.ask(question)
        
        # Update state
        state.messages.append(answer)

        # Record action
        self.record_action(
            state=state,
            action="Ask User for Clarification",
            decision=f"Asked: {question}"
        )

        return state