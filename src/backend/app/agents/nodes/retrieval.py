from __future__ import annotations

from src.backend.app.agents.nodes.base import BaseNode
from src.backend.app.agents.state import (
    ATSState,
    CandidateContext,
    ExperienceContext,
    Observation,
)
from src.backend.app.services.candidate_search_service import CandidateSearchService


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

        # Map dữ liệu an toàn (Hỗ trợ cả Dict lẫn Object/Pydantic)
        mapped_candidates: list[CandidateContext] = []
        for item in candidates:
            is_dict = isinstance(item, dict)
            
            # Helper lấy giá trị linh hoạt
            def get_val(key: str, default: str | list | None = None) -> str | list | None:
                if is_dict:
                    return item.get(key, default)
                return getattr(item, key, default)

            # Map danh sách kinh nghiệm làm việc
            experiences_raw = get_val("experiences", []) or []
            exp_contexts = [
                ExperienceContext(
                    company=exp.get("company", "") if isinstance(exp, dict) else getattr(exp, "company", ""),
                    position=exp.get("position", "") if isinstance(exp, dict) else getattr(exp, "position", ""),
                    duration=exp.get("duration", "") if isinstance(exp, dict) else getattr(exp, "duration", ""),
                    highlights=exp.get("highlights", []) if isinstance(exp, dict) else getattr(exp, "highlights", []),
                )
                for exp in experiences_raw
            ]

            # Điểm số linh hoạt (chấp nhận cả score lẫn semantic_score)
            raw_score = get_val("score") or get_val("semantic_score") or 0.0

            mapped_candidates.append(
                CandidateContext(
                    candidate_id=str(get_val("candidate_id", "")),
                    semantic_score=float(raw_score),
                    summary=str(get_val("summary", "")),
                    skills=list(get_val("skills", []) or []),
                    strengths=list(get_val("strengths", []) or []),
                    weaknesses=list(get_val("weaknesses", []) or []),
                    experiences=exp_contexts,
                    github_summary=get_val("github_summary"),
                    linkedin_summary=get_val("linkedin_summary"),
                )
            )

        state.candidate_search.candidates = mapped_candidates

        # 2. Tạo Observation (Theo tinh thần ReAct)
        top_score = mapped_candidates[0].semantic_score if mapped_candidates else 0.0
        observation = Observation(
            node="retrieval",
            summary=f"Retrieved {len(mapped_candidates)} candidates. Top score: {top_score:.4f}.",
            metadata={
                "candidate_count": len(mapped_candidates),
                "top_score": top_score,
                "hard_filter_used": bool(requirement.hard_filter),
                "lexical_hits": sum(
                    1 for c in candidates if (c.get("is_lexical") if isinstance(c, dict) else getattr(c, "is_lexical", False))
                ),
                "semantic_hits": sum(
                    1 for c in candidates if (c.get("is_semantic") if isinstance(c, dict) else getattr(c, "is_semantic", False))
                ),
            },
        )

        state.candidate_search.observations.append(observation)

        # 3. Record Action
        self.record_action(
            state=state,
            action="Hybrid Candidate Search",
            decision=f"Retrieved {len(mapped_candidates)} candidates",
        )

        return state