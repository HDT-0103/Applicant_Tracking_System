from __future__ import annotations

from uuid import UUID, uuid4

import pytest

from src.backend.app.models.enums import CandidateStatus
from src.backend.app.repositories.resume_repository import ResumeRepository


@pytest.mark.asyncio
async def test_create_resume_get_by_id_and_candidate(service_role_client):
    candidate_uuid = str(uuid4())
    email = f"resume-{candidate_uuid[:8]}@example.com"
    resume_id = None

    # 1. Tạo Candidate mẫu
    service_role_client.table("candidates").insert(
        {
            "uuid": candidate_uuid,
            "full_name": "Resume Candidate",
            "email": email,
            "status": CandidateStatus.ACTIVE.value,
        }
    ).execute()

    repository = ResumeRepository(session=None)

    try:
        # 2. Tạo Resume
        created_resume = await repository.create_resume(
            candidate_uuid=candidate_uuid,
            filename="candidate.pdf",
            file_path="/tmp/candidate.pdf",
            text_content="Experienced backend engineer.",
        )
        resume_id = str(created_resume.id)

        # 3. Assert dữ liệu trực tiếp trong DB
        stored = (
            service_role_client.table("resumes")
            .select("id, candidate_uuid, filename, text_content")
            .eq("id", resume_id)
            .limit(1)
            .execute()
        )
        assert stored.data, "Expected resume row to exist after insert."
        row = stored.data[0]
        assert row["candidate_uuid"] == candidate_uuid
        assert row["filename"] == "candidate.pdf"
        assert row["text_content"] == "Experienced backend engineer."

        # 4. Fetch qua get_resume_by_id
        by_id = await repository.get_resume_by_id(UUID(resume_id))
        assert by_id is not None
        assert str(by_id.id) == resume_id
        assert str(by_id.candidate_uuid) == candidate_uuid
        assert by_id.filename == "candidate.pdf"
        assert by_id.text_content == "Experienced backend engineer."

        # 5. Fetch qua get_resume_by_candidate
        by_candidate = await repository.get_resume_by_candidate(candidate_uuid)
        assert by_candidate is not None
        assert str(by_candidate.id) == resume_id
        assert str(by_candidate.candidate_uuid) == candidate_uuid

    finally:
        # 6. Cleanup an toàn theo candidate_uuid (tránh lỗi khóa ngoại)
        service_role_client.table("resumes").delete().eq("candidate_uuid", candidate_uuid).execute()
        service_role_client.table("candidates").delete().eq("uuid", candidate_uuid).execute()