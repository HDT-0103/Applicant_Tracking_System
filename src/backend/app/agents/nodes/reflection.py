'''LLM Decision Reflection on results and actions'''
from backend.app.agents.nodes.base import BaseNode
from backend.app.agents.state import ATSState, ActionRecord, ReflectionInput, ReflectionOutput
from backend.app.services.llm_provider import GroqProvider
class ReflectionNode(BaseNode):
    def __init__(self, llm_provider: GroqProvider):
        super().__init__()
        self.llm_provider = llm_provider
        
    async def execute(self, state: ATSState):
        with open("reflection_prompt.md", "r", encoding="utf-8") as file:
            reflection_prompt = file.read()
        # 1. Read state
        mission = state.candidate_search.mission
        history = state.candidate_search.action_history
        observation = state.candidate_search.observations[-1] if state.candidate_search.observations else None

        # 2. Build reflection input
        reflection_input = ReflectionInput(
            mission=mission,
            history=history,
            observation=observation
        )

        # 3. Call LLM, reflection prompt is defined in folder prompts/reflection_prompt.txt
        reflection_output = self.llm_provider.invoke(
            system_prompt=reflection_prompt,
            user_input=reflection_input,
            response_model=ReflectionOutput
        )

        # 4. Update state
        state.candidate_search.reflection = reflection_output.reflection

        # 5. Record history
        state.candidate_search.action_history.append(
            ActionRecord(

                step=len(state.candidate_search.action_history) + 1,
                
                node_name="ReflectionNode",

                action="Evaluate search result",

                decision=reflection_output.reflection.reason

            )
        )

        return state