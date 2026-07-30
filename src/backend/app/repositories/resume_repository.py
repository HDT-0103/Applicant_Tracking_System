from __future__ import annotations

from uuid import UUID

from src.backend.app.models.resume import Resume
from src.backend.app.repositories.base import BaseRepository


class ResumeRepository(BaseRepository):
    """Repository responsible for CRUD operations on resumes."""

    @staticmethod
    def _to_resume(row: dict | None) -> Resume | None:
        if not row:
            return None
        return Resume(**row)

    async def create_resume(
        self,
        candidate_uuid: str,
        filename: str,
        file_path: str,
        text_content: str,
    ) -> Resume:
        response = (
            self.client.table("resumes")
            .insert(
                {
                    "candidate_uuid": candidate_uuid,
                    "filename": filename,
                    "file_path": file_path,
                    "text_content": text_content,
                }
            )
            .select("*")
            .execute()
        )
        row = response.data[0] if response.data else None
        if row is None:
            raise ValueError("Failed to create resume record.")
        return Resume(**row)

    async def get_resume_by_id(
        self,
        resume_id: UUID,
    ) -> Resume | None:
        response = (
            self.client.table("resumes")
            .select("*")
            .eq("id", str(resume_id))
            .limit(1)
            .execute()
        )
        row = response.data[0] if response.data else None
        return self._to_resume(row)

    async def get_resume_by_candidate(
        self,
        candidate_uuid: str,
    ) -> Resume | None:
        response = (
            self.client.table("resumes")
            .select("*")
            .eq("candidate_uuid", candidate_uuid)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        row = response.data[0] if response.data else None
        return self._to_resume(row)

    async def update_resume_text(
        self,
        resume_id: UUID,
        text_content: str,
    ) -> Resume:
        response = (
            self.client.table("resumes")
            .update({"text_content": text_content})
            .eq("id", str(resume_id))
            .select("*")
            .execute()
        )
        row = response.data[0] if response.data else None
        if row is None:
            raise ValueError(f"Resume with ID '{resume_id}' not found.")
        return Resume(**row)

    async def delete_resume(
        self,
        resume_id: UUID,
    ) -> bool:
        response = (
            self.client.table("resumes")
            .delete()
            .eq("id", str(resume_id))
            .select("id")
            .execute()
        )
        return bool(response.data)