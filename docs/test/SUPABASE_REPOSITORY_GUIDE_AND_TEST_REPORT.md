# 📄 Integration Test Report & Quy Trình Tương Tác Với Supabase Repository

> **File Test:** `tests/repositories/test_embedding_repository.py`  
> **Trạng thái:** ✅ `2 PASSED` (24.97s)  
> **Phạm vi kiểm thử:** Tích hợp `EmbeddingService` (AI Model `multilingual-e5-base`), `EmbeddingRepository`, `EnrichmentRepository` và Database Supabase (`pgvector`).

---

# 1. Kết Quả Kiểm Thử (Test Summary)

Các test case đã hoàn thành thành công:

### ✅ `test_create_embedding_and_get_embeddings_by_profile`

- Tạo thành công **1 Candidate**
- Tạo **1 Enrichment Profile**
- Sinh **Embedding Vector 768 chiều**
- Lưu thành công **1 bản ghi Embedding**
- Truy vấn lại từ Database và xác nhận:
  - Metadata chính xác
  - Vector khớp hoàn toàn với dữ liệu đầu vào (`pytest.approx`)

---

### ✅ `test_create_embeddings_inserts_multiple_rows`

- Thực hiện **Batch Insert** nhiều Embedding cùng lúc
- Truy vấn theo `enrichment_profile_id`
- Kết quả:
  - Đúng số lượng bản ghi
  - Metadata chính xác
  - Toàn bộ Embedding được lưu thành công

---

# 2. Các Lỗi Đã Gặp & Nguyên Nhân

| Lỗi | Nguyên nhân | Giải pháp |
|------|------------|-----------|
| **PostgreSQL Error `22P02`**<br>`invalid input value for enum` | Python Enum không khớp với Enum trong PostgreSQL.<br>Ví dụ DB nhận `"ENRICHED"` nhưng Python gửi `"completed"`. | Đồng bộ giá trị `.value` của Python Enum đúng **100%** với Label trong Database. |
| **PostgreSQL Error `23502`**<br>`null value violates not-null constraint` | Payload chứa key có giá trị `None` (ví dụ: `"semantic_tags": None`). PostgreSQL hiểu là đang cố gắng insert `NULL`. | Loại bỏ toàn bộ key có giá trị `None` hoặc gán default (`[]`, `{}`). |
| **AssertionError: `9500 == 768`** | Khi `SELECT` cột kiểu `vector`, Supabase PostgREST SDK trả về **String JSON** thay vì `list[float]`. | Parse bằng `json.loads()` trước khi sử dụng. |
| **Không thấy dữ liệu trên Supabase UI** | Khối `finally` trong Integration Test tự động xóa dữ liệu sau khi test hoàn thành. | Comment phần cleanup hoặc thêm `time.sleep()` trước khi xóa dữ liệu. |

---

# 3. Quy Chuẩn Thiết Kế Repository & Insert Dữ Liệu

Sau quá trình kiểm thử, rút ra các quy chuẩn sau khi làm việc với **Supabase PostgREST API**.

---

## Quy tắc 1. Làm sạch Payload trước khi Insert

### Mục tiêu

Trước khi gọi:

```python
.insert(payload)
```

luôn thực hiện:

1. Gán giá trị mặc định cho List/Dict.
2. Loại bỏ toàn bộ key có giá trị `None`.

### Code mẫu

```python
payload = {
    "enrichment_profile_id": enrichment_profile_id,
    "source_type": (
        source_type.value
        if hasattr(source_type, "value")
        else source_type
    ),
    "text_content": text_content,
    "embedding": embedding,          # List[float] (768 chiều)
    "semantic_tags": semantic_tags or [],
}

clean_payload = {
    k: v
    for k, v in payload.items()
    if v is not None
}

response = (
    self.client
    .table("embeddings")
    .insert(clean_payload)
    .execute()
)
```

### Lợi ích

- Không vi phạm `NOT NULL constraint`
- Cho phép PostgreSQL sử dụng giá trị `DEFAULT`
- Payload sạch và dễ bảo trì

---

## Quy tắc 2. Đồng bộ Enum giữa Python và Database

### Kiểm tra Enum trong PostgreSQL

```sql
SELECT e.enumlabel
FROM pg_type t
JOIN pg_enum e
    ON t.oid = e.enumtypid
WHERE t.typname = 'enrichment_status';
```

### Python Enum phải khớp 100%

```python
from enum import Enum

class EnrichmentStatus(str, Enum):
    ENRICHED = "ENRICHED"
    FAILED = "FAILED"
    PENDING = "PENDING"
```

> ⚠️ Lưu ý: `.value` phải giống **chính xác** với `enumlabel` trong PostgreSQL.

---

## Quy tắc 3. Làm việc với cột `pgvector`

### INSERT / UPDATE

Truyền trực tiếp:

```python
List[float]
```

Ví dụ:

```python
embedding = [
    0.021,
    -0.044,
    0.193,
    ...
]
```

Supabase SDK sẽ tự serialize thành kiểu `vector`.

---

### SELECT

Supabase SDK đôi khi trả về:

```python
str
```

thay vì:

```python
list[float]
```

### Parse an toàn

```python
import json

raw_embedding = row.get("embedding")

if isinstance(raw_embedding, str):
    vector_data = json.loads(raw_embedding)
else:
    vector_data = raw_embedding
```

---

# 4. Pattern Base Repository Cho Supabase

Có thể tái sử dụng Base Class dưới đây cho toàn bộ Repository trong dự án.

```python
import json
from typing import Any, Dict, List


class BaseSupabaseRepository:
    """
    Base Repository hỗ trợ tương tác an toàn với
    Supabase PostgREST SDK.
    """

    def __init__(self, client):
        self.client = client

    def _clean_payload(
        self,
        data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Loại bỏ toàn bộ key có giá trị None.

        Mục đích:
        - Tránh lỗi NOT NULL constraint
        - Cho phép PostgreSQL sử dụng DEFAULT VALUE
        """
        return {
            k: v
            for k, v in data.items()
            if v is not None
        }

    def _parse_vector(
        self,
        vector_field: Any,
    ) -> List[float]:
        """
        Parse dữ liệu vector trả về từ Supabase SDK.
        """

        if isinstance(vector_field, str):
            return json.loads(vector_field)

        return vector_field or []
```

---

# Tổng Kết

## Những quy tắc quan trọng cần ghi nhớ

### 1. Payload

- Không insert giá trị `None`
- Gán default cho List/Dict
- Clean payload trước khi gửi

---

### 2. Enum

- `.value` của Python phải trùng **100%** với PostgreSQL Enum

---

### 3. pgvector

**Insert**

```python
list[float]
```

**Select**

```python
str
```

↓

```python
json.loads(...)
```

↓

```python
list[float]
```

---

### 4. Testing

Nếu muốn kiểm tra dữ liệu trực tiếp trên Supabase Dashboard:

- Comment phần `finally`
- Hoặc thêm `time.sleep()` trước khi cleanup

---

## ✅ Kết quả cuối cùng

- Integration Test: **2 PASSED**
- Repository hoạt động ổn định
- Embedding 768 chiều được lưu chính xác
- Batch Insert thành công
- Có thể sử dụng các pattern trên làm chuẩn cho toàn bộ Repository trong dự án