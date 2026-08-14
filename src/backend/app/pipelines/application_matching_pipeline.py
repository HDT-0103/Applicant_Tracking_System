from __future__ import annotations

import logging
from typing import Any

from src.backend.app.dtos.application_matching import ApplicationMatchResult
from src.backend.app.services.experience_matching import ExperienceMatchingService
from src.backend.app.services.github_matching import GitHubMatchingService
from src.backend.app.services.score_aggregator import ScoreAggregator
from src.backend.app.services.summary_matching import SummaryMatchingService

logger = logging.getLogger(__name__)


class ApplicationMatchingPipeline:
    """Orchestrator Service điều phối toàn bộ quá trình matching giữa 

    Candidate và Job Posting, tính toán điểm thành phần và overall_score.
    """

    def __init__(
        self,
        summary_service: SummaryMatchingService | None = None,
        experience_service: ExperienceMatchingService | None = None,
        github_service: GitHubMatchingService | None = None,
        score_aggregator: ScoreAggregator | None = None,
        application_repository: Any = None,
    ) -> None:
        self.summary_service = summary_service or SummaryMatchingService()
        self.experience_service = experience_service or ExperienceMatchingService()
        self.github_service = github_service or GitHubMatchingService()
        self.score_aggregator = score_aggregator or ScoreAggregator()
        self.application_repository = application_repository

    async def execute_matching(
        self,
        candidate_uuid: str,
        job_posting_id: str,
        job_query: str = "",
        job_embedding: list[float] | None = None,
    ) -> ApplicationMatchResult:
        """Thực thi toàn bộ Application Matching Pipeline cho 1 ứng viên và 1 công việc."""

        # 1. Summary Matching
        summary_score = await self.summary_service.match_summary(
            candidate_uuid=candidate_uuid,
            job_posting_id=job_posting_id,
        )

        # 2. Experience Matching
        experience_score = await self.experience_service.match_experience(
            candidate_uuid=candidate_uuid,
            job_posting_id=job_posting_id,
        )

        # 3. GitHub Matching
        github_score: float | None = None
        github_project_name: str | None = None
        github_emb: list[float] | None = None

        if job_embedding is not None:
            gh_result = await self.github_service.match_candidate_github(
                candidate_uuid=candidate_uuid,
                job_query=job_query,
                job_embedding=job_embedding,
            )
            github_score = gh_result.github_score
            if gh_result.best_project:
                github_project_name = gh_result.best_project.name
            github_emb = gh_result.best_embedding

        # 4. Score Aggregation (Dynamic Re-weighting)
        overall_score = self.score_aggregator.calculate_overall_score(
            summary_score=summary_score,
            experience_score=experience_score,
            github_score=github_score,
        )

        # 5. Pack Result
        result = ApplicationMatchResult(
            candidate_uuid=candidate_uuid,
            job_posting_id=job_posting_id,
            summary_score=summary_score,
            experience_score=experience_score,
            github_score=github_score,
            overall_score=overall_score,
            github_project=github_project_name,
            github_embedding=github_emb,
        )

        # 6. Optionally Update DB Application entity
        if self.application_repository and hasattr(
            self.application_repository, "update_matching_scores"
        ):
            await self.application_repository.update_matching_scores(result)

        return result