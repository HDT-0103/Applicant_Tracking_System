import asyncio
from typing import Sequence
from uuid import UUID

from supabase import Client

from src.backend.app.schemas.search import (
    LexicalSearchResult,
    SemanticSearchResult,
    SkillFilterResult,
)


class CandidateSearchRepository:
    def __init__(self, supabase_client: Client):
        self.client = supabase_client

    async def get_candidate_ids_by_skills(
        self,
        required_skills: list[str],
    ) -> list[SkillFilterResult]:
        """
        Hard Filter theo danh sách skills bắt buộc.
        """
        if not required_skills:
            return []

        payload = {"required_skills": required_skills}
        response = await asyncio.to_thread(
            lambda: self.client.rpc("get_candidate_ids_by_skills", payload).execute()
        )

        if not response.data:
            return []

        return [SkillFilterResult.model_validate(row) for row in response.data]

    async def search_profiles_lexically(
        self,
        query: str,
        top_k: int = 10,
        candidate_ids: Sequence[UUID | str] | None = None,
    ) -> list[LexicalSearchResult]:
        """
        Full-Text Search (Lexical Search) sử dụng Postgres ts_rank_cd.
        """
        if not query or not query.strip():
            return []

        formatted_candidate_ids = (
            [str(cid) for cid in candidate_ids] if candidate_ids else None
        )

        payload = {
            "query": query,
            "top_k": top_k,
            "candidate_ids": formatted_candidate_ids,
        }

        response = await asyncio.to_thread(
            lambda: self.client.rpc("search_profiles_lexically", payload).execute()
        )

        if not response.data:
            return []

        return [LexicalSearchResult.model_validate(row) for row in response.data]

    async def search_similar_embeddings(
        self,
        embedding: list[float],
        top_k: int = 10,
        candidate_ids: Sequence[UUID | str] | None = None,
        source_types: list[str] | None = None,
        minimum_similarity: float = 0.0,
    ) -> list[SemanticSearchResult]:
        """
        Vector Search (Semantic Search) sử dụng pgvector Cosine Distance.
        """
        if not embedding:
            return []

        formatted_candidate_ids = (
            [str(cid) for cid in candidate_ids] if candidate_ids else None
        )

        payload = {
            "query_embedding": embedding,
            "top_k": top_k,
            "candidate_ids": formatted_candidate_ids,
            "source_types": source_types,
            "minimum_similarity": minimum_similarity,
        }

        response = await asyncio.to_thread(
            lambda: self.client.rpc("search_similar_embeddings", payload).execute()
        )

        if not response.data:
            return []

        return [SemanticSearchResult.model_validate(row) for row in response.data]