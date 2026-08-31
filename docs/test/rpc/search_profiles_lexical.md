# Integration Test Report & RPC Guide: `search_profiles_lexically`

- **File Test:** `tests/integration/rpc/test_search_profiles_lexically.py`
- **Trạng thái:** ✅ PASSED
- **Phạm vi:** Kiểm thử PostgreSQL RPC thực hiện **Lexical Search (Full-Text Search)** trên hồ sơ ứng viên.

---

# 1. File này đã test những hàm & kịch bản gì?

## PostgreSQL RPC được kiểm thử

- **Tên RPC:** `search_profiles_lexically`

### Cơ chế hoạt động

RPC sử dụng **PostgreSQL Full-Text Search** với:

- `to_tsvector`
- `plainto_tsquery`
- `ts_rank_cd`

Dictionary sử dụng:

```sql
simple
```

Các trường được lập chỉ mục để tìm kiếm:

- `summary`
- `experience`
- `github`
- `linkedin`

Kết quả trả về bao gồm:

- `candidate_uuid`
- `enrichment_profile_id`
- `lexical_score`
- `matched_fields`

---

## Các kịch bản test đã bao phủ

### 1. Happy Path — Tìm kiếm từ khóa

**Input**

```text
query = "FastAPI"
top_k = 10
```

**Expected**

- Trả về các ứng viên chứa từ khóa.
- Có tính điểm `lexical_score`.
- Có thông tin `matched_fields`.

---

### 2. Happy Path — Tìm kiếm nhiều từ khóa

**Input**

```text
query = "FastAPI Developer"
top_k = 10
```

**Expected**

- Hỗ trợ Full-Text Search với nhiều keyword.
- Kết quả được sắp xếp theo `lexical_score`.

---

### 3. Lọc theo Candidate IDs

**Input**

```text
query = "Python"
candidate_ids = [candidate_uuid_1]
```

**Expected**

- Chỉ tìm kiếm trong danh sách Candidate UUID được truyền vào.
- Không trả về ứng viên ngoài danh sách.

---

### 4. Giới hạn số lượng kết quả

**Input**

```text
query = "Python"
top_k = 1
```

**Expected**

- Chỉ trả về đúng 1 record.
- Record có `lexical_score` cao nhất.

---

# 2. Cấu trúc gọi RPC chuẩn (Usage Pattern)

```python
from typing import List, Dict, Any, Optional
from supabase import Client


class CandidateSearchRepository:
    def __init__(self, supabase_client: Client):
        self.client = supabase_client

    async def search_profiles_lexically(
        self,
        query: str,
        top_k: int = 10,
        candidate_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Tìm kiếm hồ sơ ứng viên bằng PostgreSQL Full-Text Search.

        Parameters
        ----------
        query : str
            Chuỗi từ khóa cần tìm.
            Ví dụ:
                "FastAPI"
                "Python Developer"

        top_k : int
            Số lượng kết quả tối đa.

        candidate_ids : Optional[List[str]]
            Danh sách Candidate UUID dùng để giới hạn phạm vi tìm kiếm.
            Nếu None sẽ tìm trên toàn bộ dữ liệu.

        Returns
        -------
        List[Dict[str, Any]]

        Ví dụ:

        [
            {
                "candidate_uuid": "...",
                "enrichment_profile_id": "...",
                "lexical_score": 0.091,
                "matched_fields": "summary,experience"
            }
        ]
        """

        if not query or not query.strip():
            return []

        payload = {
            "query": query,
            "top_k": top_k,
            "candidate_ids": candidate_ids
        }

        response = (
            self.client
            .rpc("search_profiles_lexically", payload)
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
| `query` | `str` | `text` | ✅ | Chuỗi từ khóa tìm kiếm |
| `top_k` | `int` | `int` | ❌ | Giới hạn số lượng kết quả (mặc định `10`) |
| `candidate_ids` | `Optional[List[str]]` | `text[]` | ❌ | Danh sách Candidate UUID cần giới hạn tìm kiếm |

---

### Ví dụ Input

```python
payload = {
    "query": "FastAPI Python",
    "top_k": 10,
    "candidate_ids": [
        "uuid-1",
        "uuid-2"
    ]
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
        "lexical_score": 0.091,
        "matched_fields": "summary,experience"
    }
]
```

---

## Ý nghĩa các trường Output

| Field | Kiểu | Mô tả |
|--------|------|------|
| `candidate_uuid` | `str` | UUID của ứng viên |
| `enrichment_profile_id` | `str` | UUID hồ sơ enrichment |
| `lexical_score` | `float` | Điểm xếp hạng Full-Text Search (`ts_rank_cd`) |
| `matched_fields` | `str` | Danh sách các trường chứa từ khóa khớp |

---

# 4. Tổng kết

RPC `search_profiles_lexically` hỗ trợ:

- ✅ PostgreSQL Full-Text Search.
- ✅ Tìm kiếm theo một hoặc nhiều từ khóa.
- ✅ Xếp hạng kết quả bằng `ts_rank_cd`.
- ✅ Lọc theo danh sách `candidate_ids`.
- ✅ Giới hạn số lượng kết quả qua `top_k`.
- ✅ Trả về thông tin điểm (`lexical_score`) và các trường khớp (`matched_fields`).