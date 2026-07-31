from __future__ import annotations

from uuid import uuid4

import pytest

from src.backend.app.models.enums import CandidateStatus, EnrichmentStatus
from src.backend.app.repositories.enrichment_repository import EnrichmentRepository


@pytest.mark.asyncio
async def test_create_profile_get_profile_and_update_status(service_role_client):
    candidate_uuid = str(uuid4())
    email = f"enrichment-{candidate_uuid[:8]}@example.com"

    # 1. Tạo Candidate mẫu
    service_role_client.table("candidates").insert(
        {
            "uuid": candidate_uuid,
            "full_name": "Enrichment Candidate",
            "email": email,
            "status": CandidateStatus.ACTIVE.value,
        }
    ).execute()

    repository = EnrichmentRepository(session=None)

    try:
        # 2. Tạo Profile với status IN_PROGRESS
        created_profile = await repository.create_profile(
            candidate_uuid=candidate_uuid,
            skills=["Python", "FastAPI"],
            summary="Backend engineer",
            experience="5 years in APIs",
            github="https://github.com/example",
            linkedin="https://linkedin.com/in/example",
            enrichment_status=EnrichmentStatus.IN_PROGRESS,
        )
        profile_id = str(created_profile.id)

        # 3. Assert dữ liệu trực tiếp từ Supabase DB
        stored = (
            service_role_client.table("enrichment_profiles")
            .select(
                "id, candidate_uuid, skills, summary, experience, github, linkedin, enrichment_status"
            )
            .eq("candidate_uuid", candidate_uuid)
            .limit(1)
            .execute()
        )
        assert stored.data, "Expected enrichment profile row to exist after insert."
        row = stored.data[0]
        assert row["candidate_uuid"] == candidate_uuid
        assert row["skills"] == ["Python", "FastAPI"]
        assert row["summary"] == "Backend engineer"
        assert row["experience"] == "5 years in APIs"
        assert row["github"] == "https://github.com/example"
        assert row["linkedin"] == "https://linkedin.com/in/example"
        assert row["enrichment_status"] == EnrichmentStatus.IN_PROGRESS.value

        # 4. Fetch qua Repository
        fetched = await repository.get_profile(candidate_uuid)
        assert fetched is not None
        assert str(fetched.id) == profile_id
        assert str(fetched.candidate_uuid) == candidate_uuid
        assert fetched.skills == ["Python", "FastAPI"]
        assert fetched.summary == "Backend engineer"
        assert fetched.experience == "5 years in APIs"
        assert fetched.github == "https://github.com/example"
        assert fetched.linkedin == "https://linkedin.com/in/example"
        assert fetched.enrichment_status == EnrichmentStatus.IN_PROGRESS.value

        # 5. Update status sang ENRICHED
        updated = await repository.update_status(candidate_uuid, EnrichmentStatus.ENRICHED)
        assert updated.enrichment_status == EnrichmentStatus.ENRICHED.value

        refetched = await repository.get_profile(candidate_uuid)
        assert refetched is not None
        assert refetched.enrichment_status == EnrichmentStatus.ENRICHED.value

    finally:
        # 6. Cleanup an toàn theo candidate_uuid
        service_role_client.table("enrichment_profiles").delete().eq("candidate_uuid", candidate_uuid).execute()
        service_role_client.table("candidates").delete().eq("uuid", candidate_uuid).execute()