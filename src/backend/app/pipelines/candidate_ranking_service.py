from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class CandidateRankingService:
    """Service phục vụ HR xem danh sách ứng viên của 1 Job Posting

    đã được sắp xếp theo overall_score giảm dần (Option 1: Pre-calculated).
    """

    def __init__(self, application_repository: Any = None) -> None:
        self.application_repository = application_repository

    async def get_ranked_candidates_for_job(
        self,
        job_posting_id: str,
        session: AsyncSession | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """Lấy danh sách ứng viên đã nộp cho Job Posting, sắp xếp theo overall_score giảm dần."""
        
        # Nếu đã có Repository custom
        if self.application_repository and hasattr(self.application_repository, "get_ranked_applications"):
            return await self.application_repository.get_ranked_applications(
                job_posting_id=job_posting_id, limit=limit, offset=offset
            )

        # Standard SQLAlchemy Async fallback query (Nếu chưa inject Repository)
        if session is None:
            logger.warning("No session or repository provided for CandidateRankingService.")
            return []

        # Giả định query trực tiếp bảng applications (hoặc Application model)
        from src.backend.app.models import Application  # noqa

        stmt = (
            select(Application)
            .where(Application.job_posting_id == job_posting_id)
            .order_by(desc(Application.overall_score).nulls_last())
            .limit(limit)
            .offset(offset)
        )

        result = await session.execute(stmt)
        applications = result.scalars().all()

        return [
            {
                "application_id": str(app.id),
                "candidate_uuid": str(app.candidate_uuid),
                "job_posting_id": str(app.job_posting_id),
                "overall_score": app.overall_score,
                "summary_score": app.summary_score,
                "experience_score": app.experience_score,
                "github_score": app.github_score,
                "created_at": app.created_at,
            }
            for app in applications
        ]