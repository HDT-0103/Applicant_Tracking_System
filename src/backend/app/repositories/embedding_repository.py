from __future__ import annotations

from uuid import UUID

from src.backend.app.models.resume_embedding import Embedding
from src.backend.app.models.enums import EmbeddingSource
from src.backend.app.repositories.base import BaseRepository
from src.backend.app.schemas.embedding import EmbeddingCreate, EmbeddingSearchResult


class EmbeddingRepository(BaseRepository):
    """Repository responsible for persisting embedding vectors."""

    @staticmethod
    def _to_embedding(row: dict | None) -> Embedding | None:
        if not row:
            return None
        return Embedding(**row)

    async def create_embedding(
        self,
        enrichment_profile_id: UUID,
        source_type: EmbeddingSource,
        text_content: str,
        embedding: list[float],
        model_name: str = "intfloat/multilingual-e5-base",
    ) -> Embedding:
        response = (
            self.client.table("embeddings")
            .insert(
                {
                    "enrichment_profile_id": str(enrichment_profile_id),
                    "source_type": source_type.value,
                    "text_content": text_content,
                    "embedding": embedding,
                    "model_name": model_name,
                }
            )
            .select("*")
            .execute()
        )
        row = response.data[0] if response.data else None
        if row is None:
            raise ValueError("Failed to create embedding record.")
        return Embedding(**row)

    async def create_embeddings(
        self,
        embeddings: list[EmbeddingCreate],
    ) -> list[Embedding]:
        if not embeddings:
            return []

        payload = [
            {
                "enrichment_profile_id": str(item.enrichment_profile_id),
                "source_type": item.source_type.value,
                "text_content": item.text_content,
                "embedding": item.embedding,
                "model_name": item.model_name,
            }
            for item in embeddings
        ]
        response = self.client.table("embeddings").insert(payload).select("*").execute()
        return [Embedding(**row) for row in response.data or []]

    async def get_embeddings_by_profile(
        self,
        enrichment_profile_id: UUID,
    ) -> list[Embedding]:
        response = (
            self.client.table("embeddings")
            .select("*")
            .eq("enrichment_profile_id", str(enrichment_profile_id))
            .execute()
        )
        return [Embedding(**row) for row in response.data or []]

    async def search_similar_embeddings(
        self,
        query_embedding: list[float],
        top_k: int = 20,
        source_types: list[EmbeddingSource] | None = None,
        candidate_ids: list[str] | None = None,
        minimum_similarity: float | None = None,
    ) -> list[EmbeddingSearchResult]:
        params: dict[str, object] = {
            "query_embedding": query_embedding,
            "top_k": top_k,
        }
        if source_types:
            params["source_types"] = [source_type.value for source_type in source_types]
        if candidate_ids:
            params["candidate_ids"] = candidate_ids
        if minimum_similarity is not None:
            params["minimum_similarity"] = minimum_similarity

        response = self.client.rpc("search_similar_embeddings", params).execute()
        return [
            EmbeddingSearchResult(
                candidate_uuid=row["candidate_uuid"],
                enrichment_profile_id=row["enrichment_profile_id"],
                source_type=row["source_type"],
                matched_text=row["matched_text"],
                similarity_score=float(row["similarity_score"]),
            )
            for row in response.data or []
        ]