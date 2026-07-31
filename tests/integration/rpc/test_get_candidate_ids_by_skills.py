import pytest
from uuid import uuid4
from src.backend.app.models.enums import CandidateStatus, EnrichmentStatus

@pytest.mark.asyncio
async def test_get_candidate_ids_by_skills(service_role_client):
    # --- SETUP ---
    cand_1_uuid = str(uuid4()) # Candidate A: Python, FastAPI, Docker
    cand_2_uuid = str(uuid4()) # Candidate B: NodeJS, React
    
    try:
        # Insert Candidates
        service_role_client.table("candidates").insert([
            {"uuid": cand_1_uuid, "full_name": "Dev A", "email": f"deva-{cand_1_uuid[:8]}@test.com", "status": CandidateStatus.ACTIVE.value},
            {"uuid": cand_2_uuid, "full_name": "Dev B", "email": f"devb-{cand_2_uuid[:8]}@test.com", "status": CandidateStatus.ACTIVE.value}
        ]).execute()

        # Insert Enrichment Profiles (Đã sửa: enrichment_status)
        service_role_client.table("enrichment_profiles").insert([
            {"candidate_uuid": cand_1_uuid, "skills": ["Python", "FastAPI", "Docker"], "enrichment_status": EnrichmentStatus.ENRICHED.value},
            {"candidate_uuid": cand_2_uuid, "skills": ["NodeJS", "React"], "enrichment_status": EnrichmentStatus.ENRICHED.value}
        ]).execute()

        # --- TEST 1: Happy path (1 skill) ---
        res1 = service_role_client.rpc(
            "get_candidate_ids_by_skills", 
            {"required_skills": ["Python"]}
        ).execute()
        assert len(res1.data) == 1
        assert res1.data[0]["candidate_uuid"] == cand_1_uuid

        # --- TEST 2: Query nhiều skill ---
        res2 = service_role_client.rpc(
            "get_candidate_ids_by_skills", 
            {"required_skills": ["Python", "FastAPI"]}
        ).execute()
        assert len(res2.data) == 1
        assert res2.data[0]["candidate_uuid"] == cand_1_uuid

        # --- TEST 3: Skill không tồn tại ---
        res3 = service_role_client.rpc(
            "get_candidate_ids_by_skills", 
            {"required_skills": ["Rust"]}
        ).execute()
        assert len(res3.data) == 0 # Expect []

    finally:
        # --- TEARDOWN ---
        uuids = [cand_1_uuid, cand_2_uuid]
        service_role_client.table("enrichment_profiles").delete().in_("candidate_uuid", uuids).execute()
        service_role_client.table("candidates").delete().in_("uuid", uuids).execute()