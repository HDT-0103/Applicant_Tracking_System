from __future__ import annotations

import logging
from typing import Any

from src.backend.app.services.github_matching import GitHubMatchingService

logger = logging.getLogger(__name__)


class ExperienceMatchingService:
    """Service chịu trách nhiệm tính toán experience_score giữa Candidate Experience Embedding

    và Job Posting Requirements Embedding.
    """

    def __init__(
        self,
        embedding_repository: Any = None,
        job_embedding_repository: Any = None,
    ) -> None:
        self.embedding_repository = embedding_repository
        self.job_embedding_repository = job_embedding_repository

    async def _get_candidate_experience_embedding(
        self, candidate_uuid: str
    ) -> list[float] | None:
        """Helper lấy vector experience embedding của Candidate từ bảng embeddings (source_type='experience')."""
        if not self.embedding_repository:
            return None

        if hasattr(self.embedding_repository, "get_candidate_experience_embedding"):
            return await self.embedding_repository.get_candidate_experience_embedding(
                candidate_uuid
            )

        return None

    async def _get_job_requirements_embedding(
        self, job_posting_id: str
    ) -> list[float] | None:
        """Helper lấy vector requirements embedding của Job Posting từ bảng job_embeddings (source_type='requirements')."""
        if not self.job_embedding_repository:
            return None

        if hasattr(self.job_embedding_repository, "get_job_requirements_embedding"):
            return await self.job_embedding_repository.get_job_requirements_embedding(
                job_posting_id
            )

        return None

    async def match_experience(
        self,
        candidate_uuid: str,
        job_posting_id: str,
        candidate_vector: list[float] | None = None,
        job_vector: list[float] | None = None,
    ) -> float | None:
        """Tính Cosine Similarity giữa Candidate Experience Embedding và Job Requirements Embedding.

        Return semantics:
        - float ∈ [0.0, 1.0]: Đã tính toán thành công.
        - None: Một trong 2 vector embedding bị khuyết (dùng cho Dynamic Re-weighting).
        """
        # 1. Fetch Candidate Vector if not injected
        if candidate_vector is None:
            candidate_vector = await self._get_candidate_experience_embedding(
                candidate_uuid
            )

        # 2. Fetch Job Vector if not injected
        if job_vector is None:
            job_vector = await self._get_job_requirements_embedding(job_posting_id)

        # 3. Guard Clauses for Missing Data (Returns None for Dynamic Re-weighting)
        if not candidate_vector or not job_vector:
            logger.info(
                f"Missing experience/requirements embedding for Candidate ({candidate_uuid}) or Job ({job_posting_id}). Returning None."
            )
            return None

        # 4. Dimension Check
        if len(candidate_vector) != len(job_vector):
            logger.warning(
                f"Embedding dimension mismatch: candidate ({len(candidate_vector)}) vs job ({len(job_vector)})."
            )
            return None

        # 5. Calculate Similarity using existing Cosine Similarity logic
        similarity = GitHubMatchingService._cosine_similarity(
            candidate_vector, job_vector
        )

        return similarity