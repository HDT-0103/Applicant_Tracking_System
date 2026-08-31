# Integration Test Report & RPC Guide: `search_similar_embeddings`

- **File Test:** `tests/integration/rpc/test_search_similar_embeddings.py`
- **Trạng thái:** ✅ PASSED
- **Phạm vi:** Kiểm thử PostgreSQL RPC thực hiện **Semantic Search (Vector Search)** trên bảng embeddings sử dụng **pgvector** và **Cosine Distance**.

---

# 1. File này đã test những hàm & kịch bản gì?

## PostgreSQL RPC được kiểm thử

- **Tên RPC:** `search_similar_embeddings`

### Cơ chế hoạt động

RPC sử dụng **pgvector** để thực hiện Semantic Search bằng phép đo **Cosine Distance (`<=>`)** trên **HNSW Index** nhằm tìm các vector có độ tương đồng cao nhất.

**Công thức tính Similarity Score**

```text
similarity_score = 1 - (embedding <=> query_embedding)
```

Trong đó:

- `embedding`: Vector của dữ liệu ứng viên.
- `query_embedding`: Vector biểu diễn câu truy vấn.
- Giá trị `similarity_score` nằm trong khoảng **0.0 → 1.0**, càng gần **1.0** càng tương đồng.

---

## Các kịch bản test đã bao phủ

### 1. Happy Path — Semantic Matching

**Input**

```text
query_embedding ≈ Candidate 1
top_k = 10
```

**Expected**

- Trả về Candidate có vector gần nhất.
- `similarity_score > 0.9`.

---

### 2. Lọc theo loại dữ liệu (`source_types`)

**Input**

```text
source_types = ["experience"]
```

**Expected**

- Chỉ tìm kiếm trên các embedding thuộc loại `experience`.
- Bỏ qua các embedding thuộc `summary`, `github`, ...

---

### 3. Lọc theo ngưỡng tương đồng (`minimum_similarity`)

**Input**

```text
minimum_similarity = 0.5
```

**Expected**

- Loại bỏ toàn bộ kết quả có độ tương đồng nhỏ hơn `0.5`.
- Chỉ giữ lại các embedding đủ liên quan.

---

### 4. Lọc theo danh sách Candidate (`candidate_ids`)

**Input**

```text
candidate_ids = [candidate_uuid_2]
```

**Expected**

- Chỉ thực hiện Vector Search trên Candidate UUID được chỉ định.
- Thường dùng sau bước Hard Filter hoặc Skill Filter.

---

### 5. Giới hạn số lượng kết quả (`top_k`)

**Input**

```text
top_k = 2
```

Giả sử có 4 vector phù hợp.

**Expected**

- Chỉ trả về đúng **2** kết quả.
- Hai kết quả có `similarity_score` cao nhất.

---

# 2. Cấu trúc gọi RPC chuẩn (Usage Pattern)

```python
from typing import List, Dict, Any, Optional
from supabase import Client


class CandidateSearchRepository:
    def __init__(self, supabase_client: Client):
        self.client = supabase_client

    async def search_similar_embeddings(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        candidate_ids: Optional[List[str]] = None,
        source_types: Optional[List[str]] = None,
        minimum_similarity: float = 0.0
    ) -> List[Dict[str, Any]]:
        """
        Tìm kiếm ứng viên bằng Semantic Search (Vector Search).

        Parameters
        ----------
        query_embedding : List[float]
            Vector embedding của câu truy vấn.
            Ví dụ:
                embedding của "Senior Python Backend Developer"

        top_k : int
            Số lượng kết quả tối đa.

        candidate_ids : Optional[List[str]]
            Danh sách Candidate UUID dùng để giới hạn phạm vi tìm kiếm.
            Thường được truyền từ Hard Filter.

        source_types : Optional[List[str]]
            Các loại dữ liệu muốn tìm kiếm.

            Ví dụ:
                ["summary"]
                ["experience"]
                ["summary", "experience"]

        minimum_similarity : float
            Ngưỡng độ tương đồng tối thiểu.
            Giá trị từ 0.0 → 1.0.

        Returns
        -------
        List[Dict[str, Any]]

        Ví dụ:

        [
            {
                "candidate_uuid": "...",
                "enrichment_profile_id": "...",
                "source_type": "summary",
                "matched_text": "...",
                "similarity_score": 0.92
            }
        ]
        """

        if not query_embedding:
            return []

        payload = {
            "query_embedding": query_embedding,
            "top_k": top_k,
            "candidate_ids": candidate_ids,
            "source_types": source_types,
            "minimum_similarity": minimum_similarity
        }

        response = (
            self.client
            .rpc("search_similar_embeddings", payload)
            .execute()
        )

        if not response.data:
            return []

        return response.data
```

---

# 3. Quy cách Input / Output

## Input Parameters

| Parameter | Python | PostgreSQL | Required | Mô tả |
|-----------|--------|------------|----------|------|
| `query_embedding` | `List[float]` | `vector` | ✅ | Vector embedding của câu truy vấn (ví dụ 768 chiều với `e5-base`) |
| `top_k` | `int` | `int` | ❌ | Giới hạn số lượng kết quả (mặc định `10`) |
| `candidate_ids` | `Optional[List[str]]` | `text[]` | ❌ | Danh sách Candidate UUID cần giới hạn tìm kiếm |
| `source_types` | `Optional[List[str]]` | `text[]` | ❌ | Danh sách loại dữ liệu cần tìm (`summary`, `experience`, `github`, ...) |
| `minimum_similarity` | `float` | `float` | ❌ | Ngưỡng độ tương đồng tối thiểu (`0.0 → 1.0`) |

---

### Ví dụ Input

```python
payload = {
    "query_embedding": embedding,
    "top_k": 10,
    "candidate_ids": [
        "uuid-1",
        "uuid-2"
    ],
    "source_types": [
        "summary",
        "experience"
    ],
    "minimum_similarity": 0.6
}
```

---

## Output

RPC trả về danh sách record.

```python
[
    {
        "candidate_uuid": "candidate-uuid",
        "enrichment_profile_id": "profile-id",
        "source_type": "summary",
        "matched_text": "Python Backend Developer with FastAPI...",
        "similarity_score": 0.92
    }
]
```

---

## Ý nghĩa các trường Output

| Field | Kiểu | Mô tả |
|--------|------|------|
| `candidate_uuid` | `str` | UUID của ứng viên |
| `enrichment_profile_id` | `str` | UUID của hồ sơ enrichment |
| `source_type` | `str` | Loại dữ liệu khớp (`summary`, `experience`, `github`, `linkedin`, ...) |
| `matched_text` | `str` | Đoạn văn bản có embedding khớp với truy vấn |
| `similarity_score` | `float` | Điểm tương đồng ngữ nghĩa (`0.0 → 1.0`) |

---

# 4. Tổng kết RPC

RPC `search_similar_embeddings` hỗ trợ:

- ✅ Semantic Search bằng **pgvector**.
- ✅ Cosine Similarity thông qua toán tử `<=>`.
- ✅ Tìm kiếm trên **HNSW Index** để tối ưu hiệu năng.
- ✅ Giới hạn phạm vi tìm kiếm theo `candidate_ids`.
- ✅ Lọc theo `source_types`.
- ✅ Lọc theo ngưỡng `minimum_similarity`.
- ✅ Giới hạn số lượng kết quả bằng `top_k`.
- ✅ Trả về đoạn văn bản khớp (`matched_text`) cùng điểm tương đồng (`similarity_score`).

---

# Tổng kết tầng Data Retrieval

Hiện tại hệ thống đã có đầy đủ **03 RPC** phục vụ Hybrid Search:

| RPC | Mục đích | Loại tìm kiếm |
|------|----------|---------------|
| `get_candidate_ids_by_skills` | Hard Filter theo kỹ năng chính xác | Exact Match |
| `search_profiles_lexically` | Full-Text Search theo từ khóa | Lexical Search |
| `search_similar_embeddings` | Semantic Search theo Vector Embedding | Vector Search |

Ba RPC này có thể kết hợp để xây dựng quy trình **Hybrid Candidate Search**:

```text
User Query
      │
      ▼
Hard Filter (Skills)
      │
      ▼
Lexical Search (Full-Text)
      │
      ▼
Semantic Search (Vector)
      │
      ▼
Score Fusion / Ranking
      │
      ▼
Top Candidates
```

## Trạng thái hiện tại

- ✅ `get_candidate_ids_by_skills` — PASSED
- ✅ `search_profiles_lexically` — PASSED
- ✅ `search_similar_embeddings` — PASSED

**Kết luận:** Tầng **Database** và **Repository Contract** đã ổn định, sẵn sàng triển khai **Candidate Search Agent** theo kiến trúc **RAG / Hybrid Search**.