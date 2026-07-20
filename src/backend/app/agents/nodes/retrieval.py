'''Action Node for Retrieving information'''
from backend.app.agents.nodes.base import BaseNode
from backend.app.agents.state import ATSState ,CandidateSearchState, MissionStatus
from backend.app.pipelines.candidateSearching_pipeline import SemanticPipeline
from sqlalchemy.ext.asyncio import AsyncSession
class RetrievalNode(BaseNode):
    def __init__(self):
        super().__init__()
        self.retrieval = SemanticPipeline()  # Initialize the retrieval pipeline

    # state here is ATSState, trong tools phần retrieval sẽ có thêm 1 field
    # để biết requirements cho retrieval là gì
    async def execute(self, state: ATSState):
        # chỉnh lại có thêm 1 hàm để lấy requirement_id từ state embedding và search
        requirement_embedding = state.candidate_search.requirement
        result = await self.retrieval.rank_all_resumes_for_requirement(
            requirement_embedding,
            session: AsyncSession  # Pass the session to the retrieval pipeline
        )
        state.candidate_search.results = result # kiểm tra lại xem có cần thêm 1 field trong CandidateSearchState để lưu trữ kết quả retrieval không
        # Không cần ranking do đã được implement trong pipeline rồi
        return state