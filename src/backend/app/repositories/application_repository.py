from __future__ import annotations

from typing import Any
from uuid import UUID

from src.backend.app.models.application import Application
from src.backend.app.repositories.base import BaseRepository

_UNSET = object()

class ApplicationRepository(BaseRepository):
    """Repository responsible for CRUD operations on applications."""

    # [UPDATED]: Added github_project and github_embedding
    _COLUMNS = (
        "id,candidate_uuid,job_posting_id,resume_id,summary_score,"
        "experience_score,github_score,overall_score,"
        "github_project,github_embedding"
    )

    @staticmethod
    def _to_application(row: dict | None) -> Application | None:
        if not row:
            return None
        return Application(**row)

    async def create_application(
        self,
        candidate_uuid: str,  # [FIXED]: Was UUID, now str to match DB schema
        job_posting_id: UUID,
        resume_id: UUID,
    ) -> Application:
        response = (
            self.client.table("applications")
            .insert(
                {
                    "candidate_uuid": candidate_uuid,
                    "job_posting_id": str(job_posting_id),
                    "resume_id": str(resume_id),
                }
            )
            .select(self._COLUMNS)
            .execute()
        )

        row = response.data[0] if response.data else None
        if row is None:
            raise ValueError("Failed to create application record.")

        return Application(**row)

    async def get_application(self, application_id: UUID) -> Application | None:
        response = (
            self.client.table("applications")
            .select(self._COLUMNS)
            .eq("id", str(application_id))
            .limit(1)
            .execute()
        )

        row = response.data[0] if response.data else None
        return self._to_application(row)

    async def get_application_by_candidate_job_resume(
        self,
        candidate_uuid: str,  # [FIXED]
        job_posting_id: UUID,
        resume_id: UUID,
    ) -> Application | None:
        response = (
            self.client.table("applications")
            .select(self._COLUMNS)
            .eq("candidate_uuid", candidate_uuid)
            .eq("job_posting_id", str(job_posting_id))
            .eq("resume_id", str(resume_id))
            .limit(1)
            .execute()
        )

        row = response.data[0] if response.data else None
        return self._to_application(row)

    async def update_matching_scores(
        self,
        application_id: UUID,
        *,
        summary_score: float | None | object = _UNSET,
        experience_score: float | None | object = _UNSET,
        github_score: float | None | object = _UNSET,
        overall_score: float | None | object = _UNSET,
        github_project: str | None | object = _UNSET,             # [NEW]
        github_embedding: list[float] | None | object = _UNSET,   # [NEW] List float tương thích với Supabase pgvector insert
    ) -> Application:
        updates: dict[str, Any] = {}

        if summary_score is not _UNSET:
            updates["summary_score"] = summary_score
        if experience_score is not _UNSET:
            updates["experience_score"] = experience_score
        if github_score is not _UNSET:
            updates["github_score"] = github_score
        if overall_score is not _UNSET:
            updates["overall_score"] = overall_score
            
        # [NEW FIELDS]
        if github_project is not _UNSET:
            updates["github_project"] = github_project
        if github_embedding is not _UNSET:
            updates["github_embedding"] = github_embedding

        if not updates:
            existing = await self.get_application(application_id)
            if existing is None:
                raise ValueError(f"Application with ID '{application_id}' not found.")
            return existing

        response = (
            self.client.table("applications")
            .update(updates)
            .eq("id", str(application_id))
            .select(self._COLUMNS)
            .execute()
        )

        row = response.data[0] if response.data else None
        if row is None:
            raise ValueError(f"Application with ID '{application_id}' not found.")

        return Application(**row)
    
    async def get_ranked_applications(
        self,
        job_posting_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Application]:
        """Lấy danh sách Application theo job_posting_id, xếp hạng theo overall_score giảm dần."""
        response = (
            self.client.table("applications")
            .select(self._COLUMNS)
            .eq("job_posting_id", str(job_posting_id))
            .order("overall_score", desc=True, nullsfirst=False)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return [Application(**row) for row in response.data or []]