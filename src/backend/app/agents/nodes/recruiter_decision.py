import asyncio

from src.backend.app.agents.nodes.base import BaseNode
from src.backend.app.agents.state import ATSState, RecruiterDecisionOutput, RecruiterDecisionInput
from src.backend.app.services.llm_provider import LLMProvider

class RecruiterDecisionNode(BaseNode):
    def __init__(self, llm_provider: LLMProvider):
        super().__init__()
        self.llm_provider = llm_provider

    async def execute(self, state: ATSState) -> ATSState:
        recruiter_prompt = self.load_prompt("prompts/recruiter_prompt.md")

        if not state.candidate_search.candidates:
            state.candidate_search.final_decision = RecruiterDecisionOutput(
                recommendations=[],
                final_summary="No candidates were returned by the retrieval pipeline.",
            )
            self.record_action(
                state=state,
                action="Synthesize recruiter recommendation",
                decision=state.candidate_search.final_decision.final_summary,
            )
            return state
        
        # 1. Read state (Fix các biến bị trỏ sai)
        decision_input = RecruiterDecisionInput(
            mission=state.candidate_search.mission,  # Đã fix
            candidates=state.candidate_search.candidates,
            history=state.candidate_search.action_history  # Đã fix naming
        )
        
        # 2. Call LLM
        decision_output = await asyncio.to_thread(
            self.llm_provider.invoke,
            recruiter_prompt,
            decision_input,
            RecruiterDecisionOutput,
        )

        # 3. Update state
        state.candidate_search.final_decision = decision_output
        
        # 4. Record history
        self.record_action(
            state=state,
            action=decision_input.mission.current_step,
            decision=decision_output.final_summary
        )
        
        return state