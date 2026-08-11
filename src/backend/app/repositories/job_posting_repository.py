from __future__ import annotations

from uuid import UUID

from src.backend.app.models.job_posting import JobPosting
from src.backend.app.repositories.base import BaseRepository


class JobPostingRepository(BaseRepository):
    """Repository responsible for reading job postings."""

    _COLUMNS = (
        "id,job_title,department,location,seniority_level,employment_type,work_mode,"
        "target_openings,salary_min,salary_max,must_have_skills,nice_to_have_skills,"
        "description,key_responsibilities,requirements,nice_to_have_qualifications,"
        "status,created_by,created_at,updated_at"
    )

    @staticmethod
    def _to_job_posting(row: dict | None) -> JobPosting | None:
        if not row:
            return None
        return JobPosting(**row)

    async def get_job_posting(self, job_posting_id: UUID) -> JobPosting | None:
        response = (
            self.client.table("jobs_posting")
            .select(self._COLUMNS)
            .eq("id", str(job_posting_id))
            .limit(1)
            .execute()
        )
        row = response.data[0] if response.data else None
        return self._to_job_posting(row)
