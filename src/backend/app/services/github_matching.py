from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from src.backend.app.services.github_evidence import build_single_project_evidence
from src.backend.app.services.github_retrieval import (
    GitHubProjectDTO,
    GitHubRetrievalService,
)

from src.backend.app.dtos.github_matching import GitHubMatchResult

logger = logging.getLogger(__name__)


class GitHubMatchingService:
    """Service chịu trách nhiệm Embedding các project evidence và tính github_score."""

    def __init__(
        self,
        retrieval_service: GitHubRetrievalService | None = None,
        embedding_client: Any = None,  # Inject Embedding client / service của hệ thống
    ) -> None:
        self.retrieval_service = retrieval_service or GitHubRetrievalService()
        self.embedding_client = embedding_client

    async def _get_embedding(self, text: str) -> list[float]:
        """Helper gọi Embedding Model.

        (Thay thế bằng call thực tế từ EmbeddingService của dự án)
        """
        if self.embedding_client and hasattr(self.embedding_client, "embed"):
            return await self.embedding_client.embed(text)
        # Fallback/Mock nếu chưa inject client
        raise NotImplementedError("Embedding client represents actual AI service.")

    @staticmethod
    def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
        """Tính Cosine Similarity giữa 2 vector."""
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return 0.0

        dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = sum(a * a for a in vec_a) ** 0.5
        norm_b = sum(b * b for b in vec_b) ** 0.5

        if norm_a == 0 or norm_b == 0:
            return 0.0

        sim = dot_product / (norm_a * norm_b)
        # Normalize về khoảng [0.0, 1.0]
        return max(0.0, min(1.0, float(sim)))

    async def match_candidate_github(
        self,
        candidate_uuid: str,
        job_query: str,
        job_embedding: list[float],
        top_k: int = 3,
    ) -> GitHubMatchResult:
        """Thực hiện trọn gói: Retrieval -> Build Evidence -> Embed -> Match max score.

        Nếu candidate không có GitHub hoặc không tìm thấy project -> Trả về
        score = None.
        """
        # 1. Retrieve Top-K projects
        projects = await self.retrieval_service.retrieve_relevant_projects(
            candidate_uuid=candidate_uuid,
            query=job_query,
            top_k=top_k,
        )

        # Trường hợp Ứng viên không có GitHub / không tìm thấy project phù hợp
        if not projects:
            return GitHubMatchResult(
                github_score=None,
                best_project=None,
                best_embedding=None,
            )

        best_score = -1.0
        best_proj: GitHubProjectDTO | None = None
        best_emb: list[float] | None = None

        # 2. Lặp qua từng project trong Top-K để chấm điểm (Best-project / Max Strategy)
        for proj in projects:
            evidence_text = build_single_project_evidence(proj)
            if not evidence_text:
                continue

            try:
                proj_embedding = await self._get_embedding(evidence_text)
                sim_score = self._cosine_similarity(proj_embedding, job_embedding)

                if sim_score > best_score:
                    best_score = sim_score
                    best_proj = proj
                    best_emb = proj_embedding

            except Exception as e:
                logger.error(
                    f"Error embedding GitHub project {proj.name}: {e}",
                    exc_info=True,
                )

        if best_proj is None or best_score < 0:
            return GitHubMatchResult(
                github_score=None,
                best_project=None,
                best_embedding=None,
            )

        return GitHubMatchResult(
            github_score=round(best_score, 4),
            best_project=best_proj,
            best_embedding=best_emb,
        )