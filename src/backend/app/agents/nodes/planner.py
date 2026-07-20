'''LLM Decision Planner'''
from backend.app.agents.nodes.base import BaseNode
from backend.app.agents.state import ATSState, ActionRecord, PlannerInput, PlannerOutput
from backend.app.services.llm_provider import LLMProvider
class PlannerNode(BaseNode):
    def __init__(self, llm_provider: LLMProvider):
        super().__init__()
        self.llm_provider = llm_provider
    # state here is ATSState
    async def execute(self, state: ATSState):

        # 1. Read state
        mission = state.candidate_search.mission
        history = state.candidate_search.action_history
        reflection = state.candidate_search.reflection

        # 2. Build planner input
        planner_input = PlannerInput(
            mission=mission,
            history=history,
            reflection=reflection,
            user_query=state.messages[-1]
        )

        # 3. Call LLM, planner prompt is defined in folder prompts/planner_prompt.txt
        planner_output = self.llm_provider.invoke(
            system_prompt=planner_prompt,
            user_input=planner_input,
            response_model=PlannerOutput
        )

        # 4. Update state
        state.candidate_search.mission = planner_output.mission
        state.candidate_search.query_assessment = planner_output.query_assessment

        # 5. Record history
        state.candidate_search.action_history.append(
            ActionRecord(

                step=len(state.candidate_search.action_history) + 1,

                node_name=self.__class__.__name__,

                action=planner_output.mission.current_step,

                decision=planner_output.reasoning,

            )
        )

        return state