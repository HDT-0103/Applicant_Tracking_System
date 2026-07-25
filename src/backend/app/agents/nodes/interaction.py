from backend.app.agents.nodes.base import BaseNode
from backend.app.agents.state import ATSState

class InteractionNode(BaseNode):

    async def execute(self, state: ATSState):

        clarification = (
            state.candidate_search.query_assessment
            .clarification_detail
        )

        print(f"\n[ATS Assistant]")
        print(clarification.suggestion)

        user_input = input("\nYour response: ").strip()

        # append vào conversation
        state.messages.append(user_input)

        return state