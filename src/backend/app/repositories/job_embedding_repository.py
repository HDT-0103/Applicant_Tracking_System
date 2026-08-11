from __future__ import annotations

from uuid import UUID

from src.backend.app.models.enums import JobEmbeddingSource
from src.backend.app.models.job_embedding import JobEmbedding
from src.backend.app.repositories.base import BaseRepository


class JobEmbeddingRepository(BaseRepository):
    """Repository responsible for loading embeddings tied to job postings."""

    _COLUMNS = "id,job_posting_id,source_type,text_content,embedding,model_name,created_at"

    @staticmethod
    def _to_job_embedding(row: dict | None) -> JobEmbedding | None:
        if not row:
            return None
        return JobEmbedding(**row)

    async def get_embeddings_by_job_posting(
        self,
        job_posting_id: UUID,
        source_type: JobEmbeddingSource | None = None,
    ) -> list[JobEmbedding]:
        query = (
            self.client.table("job_embeddings")
            .select(self._COLUMNS)
            .eq("job_posting_id", str(job_posting_id))
        )
        if source_type is not None:
            query = query.eq("source_type", source_type.value)

        response = query.execute()
        return [JobEmbedding(**row) for row in response.data or []]
