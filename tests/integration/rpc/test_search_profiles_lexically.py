import pytest
from uuid import uuid4
from src.backend.app.models.enums import CandidateStatus, EnrichmentStatus

@pytest.mark.asyncio
async def test_search_profiles_lexically(service_role_client):
    # --- SETUP ---
    cand_1 = str(uuid4())
    cand_2 = str(uuid4())
    cand_3 = str(uuid4()) # Dùng cho test top_k
    uuids = [cand_1, cand_2, cand_3]

    try:
        # Insert Candidates
        service_role_client.table("candidates").insert([
            {"uuid": u, "full_name": f"Dev {i}", "email": f"dev{i}-{u[:8]}@test.com", "status": CandidateStatus.ACTIVE.value}
            for i, u in enumerate(uuids)
        ]).execute()

        # Insert Profiles (Đã sửa: enrichment_status)
        service_role_client.table("enrichment_profiles").insert([
            {"candidate_uuid": cand_1, "summary": "Senior Python Backend Engineer", "experience": "Built FastAPI APIs", "enrichment_status": EnrichmentStatus.ENRICHED.value},
            {"candidate_uuid": cand_2, "summary": "Python Developer", "experience": "Django and Flask", "enrichment_status": EnrichmentStatus.ENRICHED.value},
            {"candidate_uuid": cand_3, "summary": "Frontend Dev", "experience": "React and Vue", "enrichment_status": EnrichmentStatus.ENRICHED.value}
        ]).execute()

        # --- TEST 1: Happy path ---
        res1 = service_role_client.rpc(
            "search_profiles_lexically", 
            {"query": "FastAPI", "top_k": 10, "candidate_ids": None}
        ).execute()
        assert len(res1.data) == 1
        assert res1.data[0]["candidate_uuid"] == cand_1
        assert res1.data[0]["lexical_score"] > 0

        # --- TEST 2: Filter theo candidate_ids ---
        res2 = service_role_client.rpc(
            "search_profiles_lexically", 
            {"query": "Python", "top_k": 10, "candidate_ids": [cand_2]}
        ).execute()
        assert len(res2.data) == 1
        assert res2.data[0]["candidate_uuid"] == cand_2

        # --- TEST 3: Test top_k ---
        res3 = service_role_client.rpc(
            "search_profiles_lexically", 
            {"query": "Python", "top_k": 1, "candidate_ids": None}
        ).execute()
        assert len(res3.data) == 1

        # --- TEST 4: Query không match ---
        res4 = service_role_client.rpc(
            "search_profiles_lexically", 
            {"query": "Blockchain Solidity", "top_k": 10, "candidate_ids": None}
        ).execute()
        assert len(res4.data) == 0

    finally:
        # --- TEARDOWN ---
        service_role_client.table("enrichment_profiles").delete().in_("candidate_uuid", uuids).execute()
        service_role_client.table("candidates").delete().in_("uuid", uuids).execute()