# Integration Test Report & RPC Guide: `get_candidate_ids_by_skills`

> **File Test:** `tests/integration/rpc/test_get_candidate_ids_by_skills.py`
> **Trạng thái:** `PASSED`
> **Phạm vi:** Kiểm thử RPC Function lọc Candidate theo danh sách kỹ năng bắt buộc (Hard Filter).

---

## 1. File Này Đã Test Những Hàm & Kịch Bản Gì?

### Hàm PostgreSQL RPC được test

- **Tên RPC:** `get_candidate_ids_by_skills`
- **Cơ chế DB:** Dùng toán tử chứa mảng Postgres (`skills @> required_skills`) để tìm các profile chứa **toàn bộ** các skills truyền vào.

### Các kịch bản Test đã bao phủ

1. **Happy Path (Lọc 1 skill)**

   - Transmission: `required_skills = ["Python"]`
   - Expected: Trả về Candidate có chứa skill `"Python"`.

2. **Query kết hợp nhiều skills**

   - Transmission: `required_skills = ["Python", "FastAPI"]`
   - Expected: Chỉ trả về Candidate có chứa **đồng thời cả 2 skill** này.

3. **Skill không tồn tại**

   - Transmission: `required_skills = ["Rust"]`
   - Expected: Trả về mảng rỗng `[]` (không báo lỗi).

---

## 2. Cấu Trúc Truy Vấn Chuẩn Trong Python (Usage Pattern)

```python
from typing import List
from supabase import Client

class CandidateSearchRepository:
    def __init__(self, supabase_client: Client):
        self.client = supabase_client

    async def get_candidate_ids_by_skills(self, required_skills: List[str]) -> List[str]:
        """
        Lấy danh sách candidate_uuid khớp đầy đủ các skill bắt buộc.

        :param required_skills: Danh sách kỹ năng cần lọc
        :return: Danh sách candidate_uuid
        """
        if not required_skills:
            return []

        response = self.client.rpc(
            "get_candidate_ids_by_skills",
            {
                "required_skills": required_skills
            }
        ).execute()

        if not response.data:
            return []

        return [row["candidate_uuid"] for row in response.data]
```

---

## 3. Quy Cụ Thể Về Data Input / Output

| Thành phần | Python | PostgreSQL | Ví dụ |
|------------|--------|------------|-------|
| Input | `{"required_skills": list[str]}` | `text[]` | `{"required_skills":["Python"]}` |
| Output Raw | `list[dict]` | `TABLE(candidate_uuid text)` | `[{"candidate_uuid":"uuid"}]` |
| Output Clean | `list[str]` | - | `["uuid"]` |

---

## 4. Chạy Test

```bash
python -m pytest tests/integration/rpc/test_get_candidate_ids_by_skills.py -v -s

python -m pytest tests/integration/rpc/test_search_profiles_lexically.py -v -s

python -m pytest tests/integration/rpc/test_search_similar_embeddings.py -v -s
```