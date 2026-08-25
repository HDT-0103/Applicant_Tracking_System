import pytest
from uuid import uuid4
from src.backend.app.models.enums import CandidateStatus, EnrichmentStatus

def generate_vector(value1: float, value2: float) -> list[float]:
    """Tạo vector 768 chiều. Set 2 giá trị đầu để điều hướng vector, còn lại là 0"""
    vec = [0.0] * 768
    vec[0] = value1
    vec[1] = value2
    return vec

@pytest.mark.asyncio
async def test_search_similar_embeddings(service_role_client):
    # --- SETUP ---
    cand_1 = str(uuid4()) # Backend Python
    cand_2 = str(uuid4()) # Frontend React
    uuids = [cand_1, cand_2]
    
    try:
        # 1. Insert Candidates
        service_role_client.table("candidates").insert([
            {"uuid": cand_1, "full_name": "Dev A", "email": f"a-{cand_1[:8]}@test.com", "status": CandidateStatus.ACTIVE.value},
            {"uuid": cand_2, "full_name": "Dev B", "email": f"b-{cand_2[:8]}@test.com", "status": CandidateStatus.ACTIVE.value}
        ]).execute()

        # 2. Insert Profiles
        prof_res = service_role_client.table("enrichment_profiles").insert([
            {"candidate_uuid": cand_1, "enrichment_status": EnrichmentStatus.ENRICHED.value},
            {"candidate_uuid": cand_2, "enrichment_status": EnrichmentStatus.ENRICHED.value}
        ]).execute()
        prof_1_id = prof_res.data[0]["id"]
        prof_2_id = prof_res.data[1]["id"]

        # 3. Insert Embeddings ban đầu
        # Cand 1 (prof_1_id): source_type = "summary"
        # Cand 2 (prof_2_id): source_type = "experience"
        service_role_client.table("embeddings").insert([
            {
                "enrichment_profile_id": prof_1_id,
                "source_type": "summary",
                "text_content": "Python Backend Engineer",
                "embedding": generate_vector(1.0, 0.0) 
            },
            {
                "enrichment_profile_id": prof_2_id,
                "source_type": "experience",
                "text_content": "React Frontend Developer",
                "embedding": generate_vector(0.0, 1.0)
            }
        ]).execute()

        query_vector = generate_vector(1.0, 0.0)

        # Vector search chạy trên TOÀN BỘ bảng `embeddings`, mà Supabase dùng
        # chung đã có sẵn hồ sơ thật. Không gắn nhãn được như skill dạng chuỗi,
        # nên khoanh vùng bằng chính tham số `candidate_ids` của RPC — nhờ vậy
        # mới đếm chính xác được và test không phụ thuộc dữ liệu có sẵn.
        scope = {"candidate_ids": uuids}

        # --- TEST 1: Happy path ---
        res1 = service_role_client.rpc(
            "search_similar_embeddings",
            {"query_embedding": query_vector, "top_k": 10, **scope}
        ).execute()
        assert len(res1.data) > 0
        assert res1.data[0]["candidate_uuid"] == cand_1
        assert res1.data[0]["similarity_score"] > 0.9

        # --- TEST 2: Filter theo source_types ---
        res2 = service_role_client.rpc(
            "search_similar_embeddings",
            {
                "query_embedding": query_vector,
                "top_k": 10,
                "source_types": ["experience"],
                **scope,
            }
        ).execute()
        assert len(res2.data) == 1
        assert res2.data[0]["candidate_uuid"] == cand_2

        # --- TEST 3: minimum_similarity ---
        res3 = service_role_client.rpc(
            "search_similar_embeddings",
            {
                "query_embedding": query_vector,
                "top_k": 10,
                "minimum_similarity": 0.5,
                **scope,
            }
        ).execute()
        assert len(res3.data) == 1
        assert res3.data[0]["candidate_uuid"] == cand_1

        # --- TEST 4: Filter theo candidate_ids ---
        res4 = service_role_client.rpc(
            "search_similar_embeddings", 
            {
                "query_embedding": query_vector, 
                "top_k": 10,
                "candidate_ids": [cand_2]
            }
        ).execute()
        assert len(res4.data) == 1
        assert res4.data[0]["candidate_uuid"] == cand_2

        # --- TEST 5: Test top_k ---
        # SỬA LỖI Ở ĐÂY: Dùng các source_type khác nhau cho prof_1_id để không bị trùng Unique Key
        extra_source_types = ["experience", "github", "linkedin"]
        service_role_client.table("embeddings").insert([
            {
                "enrichment_profile_id": prof_1_id, 
                "source_type": src_type, 
                "text_content": f"Content for {src_type}", 
                "embedding": query_vector
            }
            for src_type in extra_source_types
        ]).execute()

        # Hiện tại prof_1_id có 4 embeddings (summary + 3 cái vừa thêm)
        # Truy vấn với top_k = 2
        res5 = service_role_client.rpc(
            "search_similar_embeddings",
            {"query_embedding": query_vector, "top_k": 2, **scope}
        ).execute()
        assert len(res5.data) == 2 # Đáng lẽ khớp 4, nhưng bị limit còn 2

    finally:
        # --- TEARDOWN ---
        prof_ids = [prof_1_id, prof_2_id]
        service_role_client.table("embeddings").delete().in_("enrichment_profile_id", prof_ids).execute()
        service_role_client.table("enrichment_profiles").delete().in_("candidate_uuid", uuids).execute()
        service_role_client.table("candidates").delete().in_("uuid", uuids).execute()