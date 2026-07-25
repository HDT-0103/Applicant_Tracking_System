from backend.app.agents.nodes.base import BaseNode
from backend.app.agents.state import ATSState, ActionRecord, Observation
from backend.app.pipelines.candidateSearching_pipeline import SemanticPipeline
from sqlalchemy.ext.asyncio import AsyncSession
class RetrievalNode(BaseNode):

    def __init__(
        self,
        pipeline: SemanticPipeline,
        session: AsyncSession
    ):
        self.pipeline = pipeline
        self.session = session

    async def execute(self, state: ATSState):

        candidates = await self.pipeline.search_candidates(
            requirement_id=state.candidate_search.requirement_id,
            session=self.session,
            top_k=5
        )

        state.candidate_search.candidates = candidates

        state.candidate_search.observations.append(
            Observation(
                node="Retrieval",
                summary=f"Retrieved {len(candidates)} candidates."
            )
        )

        state.candidate_search.action_history.append(
            ActionRecord(
                step=len(state.candidate_search.action_history) + 1,
                node_name=self.__class__.__name__,
                action="Semantic candidate retrieval",
                decision=None
            )
        )

        return state