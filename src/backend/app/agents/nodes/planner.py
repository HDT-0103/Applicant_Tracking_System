import asyncio

from src.backend.app.agents.nodes.base import BaseNode
from src.backend.app.agents.state import ATSState, PlannerInput, PlannerOutput
from src.backend.app.services.llm_provider import LLMProvider

class PlannerNode(BaseNode):
    def __init__(self, llm_provider: LLMProvider):
        super().__init__()
        self.llm_provider = llm_provider

    async def execute(self, state: ATSState) -> ATSState:
        planner_prompt = self.load_prompt("prompts/planner_prompt.md")
        
        # 1. Read state
        mission = state.candidate_search.mission
        history = state.candidate_search.action_history
        reflection = state.candidate_search.reflection
        user_query = state.messages[-1] if state.messages else mission.objective

        # 2. Build planner input
        planner_input = PlannerInput(
            mission=mission,
            history=history,
            reflection=reflection,
            user_query=user_query,
            initial_search_criteria=state.initial_search_criteria,
        )

        # 3. Call LLM
        planner_output = await asyncio.to_thread(
            self.llm_provider.invoke,
            planner_prompt,
            planner_input,
            PlannerOutput,
        )

        # 4. Update state (Tách SearchRequirement và QueryAssessment)
        state.candidate_search.mission = planner_output.mission
        state.candidate_search.search_requirement = planner_output.search_requirement
        state.candidate_search.query_assessment = planner_output.query_assessment

        # 5. Record history
        self.record_action(
            state=state,
            action=planner_output.mission.current_step,
            decision=planner_output.reasoning
        )

        return state