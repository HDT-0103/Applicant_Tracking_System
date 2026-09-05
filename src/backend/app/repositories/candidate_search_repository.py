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

    async def get_candidate_details(
        self, candidate_ids: Sequence[UUID | str]
    ) -> list[dict]:
        if not candidate_ids:
            return []

        response = await asyncio.to_thread(
            lambda: self.client.table("candidates")
            .select(
                "uuid, full_name, email, phone, github_username, github_url, "
                "linkedin_url, enrichment_profiles!left(summary, skills)"
            )
            .in_("uuid", [str(candidate_id) for candidate_id in candidate_ids])
            .execute()
        )

        rows: list[dict] = []
        for row in response.data or []:
            profiles = row.get("enrichment_profiles") or []
            profile = profiles[0] if isinstance(profiles, list) and profiles else profiles
            profile = profile or {}
            rows.append(
                {
                    "candidate_uuid": row.get("uuid"),
                    "full_name": row.get("full_name"),
                    "email": row.get("email"),
                    "phone": row.get("phone"),
                    "github_username": row.get("github_username"),
                    "github_url": row.get("github_url"),
                    "linkedin_url": row.get("linkedin_url"),
                    "summary": profile.get("summary"),
                    "skills": profile.get("skills"),
                }
            )
        return rows