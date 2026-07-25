'''LLM Decision Making for Recruiter'''
from backend.app.agents.nodes.base import BaseNode
from backend.app.agents.state import ATSState, RecruiterDecisionOutput, RecruiterDecisionInput, ActionRecord
from backend.app.services.llm_provider import GroqProvider

class RecruiterDecisionNode(BaseNode):
    def __init__(self, llm_provider: GroqProvider):
        super().__init__()
        self.llm_provider = llm_provider

    async def execute(self, state: ATSState):
        with open("recruiter_prompt.md", "r", encoding="utf-8") as file:
            recruiter_prompt = file.read()
        
        
        # 1. Read state
        candidate = state.candidate_search.candidates 
        decision_input = RecruiterDecisionInput(
            mission=state.mission,
            candidates=candidate,
            history=state.candidate_search.history
        )
        # 2. Build reflection input 
        reflection_output = self.llm_provider.invoke(
            system_prompt=recruiter_prompt,
            user_input=decision_input,
            response_model=RecruiterDecisionOutput
        )

        # 3. Update state with reflection output
        state.candidate_search.final_decision = reflection_output
        state.candidate_search.action_history.append(
            ActionRecord(

                step=len(state.candidate_search.action_history) + 1,

                node_name=self.__class__.__name__,

                action=decision_input.mission.current_step,

                decision=reflection_output.final_summary

            )
        )
        return state