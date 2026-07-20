'''LLM Decision Making for Recruiter'''
from backend.app.agents.nodes.base import BaseNode
from backend.app.agents.state import ATSState, ActionRecord, ReflectionInput, ReflectionOutput
from backend.app.services.llm_provider import GroqProvider

class RecruiterDecisionNode(BaseNode):
    def __init__(self, llm_provider: GroqProvider):
        super().__init__()
        self.llm_provider = llm_provider
        
    async def execute(self, state: ATSState):

        # 1. Read state
        candidate = state.candidate_search.candidates[-1] if state.candidate_search.candidates else None
        # 2. Build reflection input 
        reflection_output = self.llm_provider.invoke(
            system_prompt=recruiter_prompt,
            user_input=,
            response_model=
        )

        