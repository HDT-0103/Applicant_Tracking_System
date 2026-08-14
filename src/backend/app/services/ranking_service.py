from typing import Dict, List
from uuid import UUID
from pydantic import BaseModel

from src.backend.app.schemas.search import LexicalSearchResult, SemanticSearchResult


class CandidateScoreFusion(BaseModel):
    candidate_uuid: UUID
    lexical_score: float = 0.0
    sem_summary_score: float = 0.0
    sem_exp_score: float = 0.0
    final_score: float = 0.0


class RankingService:
    def __init__(
        self,
        w_lexical: float = 0.2,
        w_sem_summary: float = 0.4,
        w_sem_experience: float = 0.4,
    ):
        self.w_lexical = w_lexical
        self.w_sem_summary = w_sem_summary
        self.w_sem_experience = w_sem_experience

    def fuse_and_rank(
        self,
        lexical_results: List[LexicalSearchResult],
        sem_summary_results: List[SemanticSearchResult],
        sem_exp_results: List[SemanticSearchResult],
        top_k: int,
        min_similarity: float = 0.0,
    ) -> List[CandidateScoreFusion]:
        fusion_map: Dict[UUID, CandidateScoreFusion] = {}

        def get_or_create(cid: UUID) -> CandidateScoreFusion:
            if cid not in fusion_map:
                fusion_map[cid] = CandidateScoreFusion(candidate_uuid=cid)
            return fusion_map[cid]

        # 1. Chuẩn hóa Lexical Score (Min-Max Scaling đơn giản bằng Max Value)
        max_lexical = max((r.lexical_score for r in lexical_results), default=1.0)
        max_lexical = max_lexical if max_lexical > 0 else 1.0

        for r in lexical_results:
            item = get_or_create(r.candidate_uuid)
            item.lexical_score = max(item.lexical_score, r.lexical_score / max_lexical)

        # 2. Semantic Score (Đã là Cosine Similarity từ 0.0 - 1.0)
        for r in sem_summary_results:
            if r.similarity_score >= min_similarity:
                item = get_or_create(r.candidate_uuid)
                item.sem_summary_score = max(item.sem_summary_score, r.similarity_score)

        for r in sem_exp_results:
            if r.similarity_score >= min_similarity:
                item = get_or_create(r.candidate_uuid)
                item.sem_exp_score = max(item.sem_exp_score, r.similarity_score)

        # 3. Weighted Sum Fusion
        for item in fusion_map.values():
            item.final_score = (
                self.w_lexical * item.lexical_score
                + self.w_sem_summary * item.sem_summary_score
                + self.w_sem_experience * item.sem_exp_score
            )

        # 4. Sort & Cut Top-K
        ranked = sorted(fusion_map.values(), key=lambda x: x.final_score, reverse=True)
        return ranked[:top_k]