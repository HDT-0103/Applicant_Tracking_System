import pytest
from uuid import uuid4
from src.backend.app.models.enums import CandidateStatus, EnrichmentStatus

@pytest.mark.asyncio
async def test_get_candidate_ids_by_skills(service_role_client):
    # --- SETUP ---
    cand_1_uuid = str(uuid4()) # Candidate A: Python, FastAPI, Docker
    cand_2_uuid = str(uuid4()) # Candidate B: NodeJS, React

    # RPC tìm trên TOÀN BỘ bảng, mà Supabase dùng chung đã có sẵn ứng viên thật
    # cũng biết "Python". Gắn nhãn riêng cho mỗi lần chạy để đếm được chính xác
    # và để hai lần chạy song song không giẫm lên nhau.
    tag = uuid4().hex[:8]
    py, fastapi_, docker = f"Python-{tag}", f"FastAPI-{tag}", f"Docker-{tag}"
    nodejs, react = f"NodeJS-{tag}", f"React-{tag}"
    absent = f"Rust-{tag}"

    try:
        # Insert Candidates
        service_role_client.table("candidates").insert([
            {"uuid": cand_1_uuid, "full_name": "Dev A", "email": f"deva-{cand_1_uuid[:8]}@test.com", "status": CandidateStatus.ACTIVE.value},
            {"uuid": cand_2_uuid, "full_name": "Dev B", "email": f"devb-{cand_2_uuid[:8]}@test.com", "status": CandidateStatus.ACTIVE.value}
        ]).execute()

        # Insert Enrichment Profiles (Đã sửa: enrichment_status)
        service_role_client.table("enrichment_profiles").insert([
            {"candidate_uuid": cand_1_uuid, "skills": [py, fastapi_, docker], "enrichment_status": EnrichmentStatus.ENRICHED.value},
            {"candidate_uuid": cand_2_uuid, "skills": [nodejs, react], "enrichment_status": EnrichmentStatus.ENRICHED.value}
        ]).execute()

        # --- TEST 1: Happy path (1 skill) ---
        res1 = service_role_client.rpc(
            "get_candidate_ids_by_skills",
            {"required_skills": [py]}
        ).execute()
        assert len(res1.data) == 1
        assert res1.data[0]["candidate_uuid"] == cand_1_uuid

        # --- TEST 2: Query nhiều skill ---
        res2 = service_role_client.rpc(
            "get_candidate_ids_by_skills",
            {"required_skills": [py, fastapi_]}
        ).execute()
        assert len(res2.data) == 1
        assert res2.data[0]["candidate_uuid"] == cand_1_uuid

        # --- TEST 3: Skill không tồn tại ---
        res3 = service_role_client.rpc(
            "get_candidate_ids_by_skills",
            {"required_skills": [absent]}
        ).execute()
        assert len(res3.data) == 0 # Expect []

        # --- TEST 4: Ứng viên chỉ khớp MỘT phần không được lọt ---
        res4 = service_role_client.rpc(
            "get_candidate_ids_by_skills",
            {"required_skills": [py, nodejs]}
        ).execute()
        assert len(res4.data) == 0, "Phải khớp ĐỦ skill, không phải khớp bất kỳ"

    finally:
        # --- TEARDOWN ---
        uuids = [cand_1_uuid, cand_2_uuid]
        service_role_client.table("enrichment_profiles").delete().in_("candidate_uuid", uuids).execute()
        service_role_client.table("candidates").delete().in_("uuid", uuids).execute()