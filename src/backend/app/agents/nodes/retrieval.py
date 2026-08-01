from backend.app.agents.nodes.base import BaseNode
from backend.app.agents.state import ATSState, Observation, CandidateContext, ExperienceContext
from backend.app.services.candidate_search_service import CandidateSearchService

class RetrievalNode(BaseNode):
    def __init__(self, search_service: CandidateSearchService):
        super().__init__()
        self.search_service = search_service

    async def execute(self, state: ATSState) -> ATSState:
        requirement = state.candidate_search.search_requirement
        if not requirement:
            state.candidate_search.candidates = []
            self.record_action(state, "Candidate Search", "Skipped - No requirements")
            return state

        # 1. Thực hiện tìm kiếm
        candidates = await self.search_service.search(
            requirement=requirement,
            top_k=10,
        )
        state.candidate_search.candidates = [
            CandidateContext(
                candidate_id=item.candidate_id,
                semantic_score=item.score,
                summary=item.summary,
                skills=item.skills,
                strengths=item.strengths,
                weaknesses=item.weaknesses,
                experiences=[
                    ExperienceContext(
                        company=exp.company,
                        position=exp.position,
                        duration=exp.duration,
                        highlights=exp.highlights,
                    )
                    for exp in item.experiences
                ],
                github_summary=item.github_summary,
                linkedin_summary=item.linkedin_summary,
            )
            for item in candidates
        ]

        # 2. Tạo Observation (Theo tinh thần ReAct)
        observation = Observation(
            node="retrieval",
            summary=f"Retrieved {len(candidates)} candidates. Top score: {candidates[0].score if candidates else 0.0:.4f}.",
            metadata={
                "candidate_count": len(candidates),
                "top_score": candidates[0].score if candidates else 0.0,
                "hard_filter_used": bool(requirement.hard_filter),
                "lexical_hits": sum(1 for c in candidates if getattr(c, 'is_lexical', False)),
                "semantic_hits": sum(1 for c in candidates if getattr(c, 'is_semantic', False)),
            },
        )
        
        state.candidate_search.observations.append(observation)

        # 3. Record Action
        self.record_action(
            state=state,
            action="Hybrid Candidate Search",
            decision=f"Retrieved {len(candidates)} candidates"
        )
        
        return state