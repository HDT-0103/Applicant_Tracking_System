from __future__ import annotations

import logging
from uuid import UUID

from src.backend.app.models.application import Application
from src.backend.app.repositories.application_repository import ApplicationRepository

logger = logging.getLogger(__name__)


class CandidateRankingService:
    """Service phục vụ HR xem danh sách ứng viên đã xếp hạng cho 1 Job Posting.

    Sử dụng Option 1 (Pre-calculated scores): Kết quả được lấy trực tiếp từ DB via ApplicationRepository.
    """

    def __init__(self, application_repository: ApplicationRepository) -> None:
        self.application_repository = application_repository

    async def get_ranked_candidates_for_job(
        self,
        job_posting_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Application]:
        """Lấy danh sách ứng viên đã xếp hạng theo overall_score giảm dần."""
        logger.info(f"Fetching ranked candidates for job_posting_id={job_posting_id}")
        return await self.application_repository.get_ranked_applications(
            job_posting_id=job_posting_id,
            limit=limit,
            offset=offset,
        )