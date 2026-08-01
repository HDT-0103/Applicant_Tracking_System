import asyncio

from backend.app.agents.nodes.base import BaseNode
from backend.app.agents.state import ATSState, ReflectionInput, ReflectionOutput, Reflection, MissionStatus
from backend.app.services.llm_provider import GroqProvider

class ReflectionNode(BaseNode):
    def __init__(self, llm_provider: GroqProvider):
        super().__init__()
        self.llm_provider = llm_provider
        
    async def execute(self, state: ATSState) -> ATSState:
        reflection_prompt = self.load_prompt("prompts/reflection_prompt.md")
        
        # 1. Read state (Lấy Observation mới nhất)
        mission = state.candidate_search.mission
        history = state.candidate_search.action_history
        observation = state.candidate_search.observations[-1] if state.candidate_search.observations else None

        if observation is None:
            state.candidate_search.reflection = Reflection(
                retry=False,
                reason="No observation available for reflection.",
                suggestion="Proceed to recruiter decision with the current evidence.",
            )
            self.record_action(
                state=state,
                action="Evaluate search result",
                decision=state.candidate_search.reflection.reason,
            )
            return state

        # 2. Build reflection input
        reflection_input = ReflectionInput(
            mission=mission,
            history=history,
            observation=observation  # Không truyền full candidates vào đây
        )

        # 3. Call LLM
        reflection_output = await asyncio.to_thread(
            self.llm_provider.invoke,
            reflection_prompt,
            reflection_input,
            ReflectionOutput,
        )

        # 4. Update state
        reflection = reflection_output.reflection

        if reflection.retry:
            mission.retry_count += 1
            if mission.retry_count >= mission.max_retries:
                reflection = Reflection(
                    retry=False,
                    reason=f"Retry limit reached ({mission.max_retries}).",
                    suggestion="Stop retrying and synthesize recruiter decision.",
                )
                mission.status = MissionStatus.FAILED

        state.candidate_search.reflection = reflection

        # 5. Record history
        self.record_action(
            state=state,
            action="Evaluate search result",
            decision=reflection.reason,
        )

        return state