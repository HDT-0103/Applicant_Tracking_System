import asyncio
from typing import List, Optional
from uuid import UUID

from backend.app.dtos.candidate_search import (
    CandidateSearchResultDTO,
    SearchRequirementDTO,
)
from backend.app.mappers.candidate_mapper import CandidateMapper
from backend.app.repositories.candidate_search_repository import CandidateSearchRepository
from backend.app.repositories.enrichment_repository import EnrichmentRepository
from backend.app.services.embedding_service import EmbeddingService
from backend.app.services.ranking_service import CandidateScoreFusion, RankingService


class CandidateSearchService:
    def __init__(
        self,
        search_repository: CandidateSearchRepository,
        enrichment_repository: EnrichmentRepository,
        embedding_service: EmbeddingService,
        ranking_service: RankingService,
        min_similarity: float = 0.5,
    ):
        self.search_repo = search_repository
        self.enrichment_repo = enrichment_repository
        self.embedding_service = embedding_service
        self.ranking_service = ranking_service
        self.min_similarity = min_similarity

    async def search(
        self,
        requirement: SearchRequirementDTO,
        top_k: int = 10,
    ) -> List[CandidateSearchResultDTO]:
        # 1. Hard Filter
        candidate_ids = await self._apply_hard_filters(requirement)
        if candidate_ids is not None and len(candidate_ids) == 0:
            return []

        fetch_k = top_k * 2

        # 2. Lexical Search
        lexical_query = f"{requirement.soft_query.summary}\n{requirement.soft_query.experience}".strip()
        lexical_results = []
        if lexical_query:
            lexical_results = await self.search_repo.search_profiles_lexically(
                query=lexical_query, top_k=fetch_k, candidate_ids=candidate_ids
            )

        # 3. Semantic Search (Ép prefix 'query:' đúng yêu cầu mô hình E5)
        sem_summary_results, sem_exp_results = [], []
        if requirement.soft_query.summary.strip():
            summary_emb = await asyncio.to_thread(
                self.embedding_service.embed_text,
                f"query: {requirement.soft_query.summary}",
            )
            sem_summary_results = await self.search_repo.search_similar_embeddings(
                embedding=summary_emb, top_k=fetch_k, candidate_ids=candidate_ids, source_types=["summary"]
            )

        if requirement.soft_query.experience.strip():
            exp_emb = await asyncio.to_thread(
                self.embedding_service.embed_text,
                f"query: {requirement.soft_query.experience}",
            )
            sem_exp_results = await self.search_repo.search_similar_embeddings(
                embedding=exp_emb, top_k=fetch_k, candidate_ids=candidate_ids, source_types=["experience"]
            )

        # 4. Fusion & Ranking via RankingService
        ranked_items = self.ranking_service.fuse_and_rank(
            lexical_results=lexical_results,
            sem_summary_results=sem_summary_results,
            sem_exp_results=sem_exp_results,
            top_k=top_k,
            min_similarity=self.min_similarity,
        )

        if not ranked_items:
            return []

        # 5. Hydrate Candidate Results via CandidateMapper
        return await self._hydrate_candidates(ranked_items)

    async def _apply_hard_filters(self, requirement: SearchRequirementDTO) -> Optional[List[UUID]]:
        """Xử lý Hard Filter linh hoạt, chuẩn bị sẵn structure cho các tiêu chí mở rộng."""
        if not requirement.hard_filter:
            return None

        matched_ids: Optional[set[UUID]] = None

        # Filter by Skills
        if requirement.hard_filter.skills:
            skill_res = await self.search_repo.get_candidate_ids_by_skills(requirement.hard_filter.skills)
            skill_ids = {r.candidate_uuid for r in skill_res}
            matched_ids = skill_ids if matched_ids is None else matched_ids.intersection(skill_ids)

        # TODO: Filter by University / Education / Location khi RPC ready
        # if requirement.hard_filter.university: ...

        return list(matched_ids) if matched_ids is not None else None

    async def _hydrate_candidates(
        self, ranked_items: List[CandidateScoreFusion]
    ) -> List[CandidateSearchResultDTO]:
        uuids = [item.candidate_uuid for item in ranked_items]
        enrichment_profiles = await self.enrichment_repo.get_profiles_by_candidate_ids(uuids)
        profile_map = {str(p.candidate_uuid): p for p in enrichment_profiles}

        results: List[CandidateSearchResultDTO] = []
        for item in ranked_items:
            profile = profile_map.get(str(item.candidate_uuid))
            if profile:
                dto = CandidateMapper.to_search_result_dto(profile, item.final_score)
                results.append(dto)

        return results