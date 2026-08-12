# 📚 Tài liệu Kỹ thuật Module: GitHub Project Retrieval

> **Status:** ✅ Integration Test Passed — 100%
> **Module:** GitHub Project Retrieval
> **Backend:** Python
> **Database:** Supabase
> **Testing:** Pytest

---

## 1. Các thành phần đã triển khai (What was implemented)

### 🔹 Layer 1: Repository

**File:** `src/backend/app/repositories/github_profile.py`

Đã thêm method **`search_projects_lexically`**.

#### Chức năng

* Gọi RPC Function `search_github_projects_lexically` trên Supabase Database.
* Trả về dữ liệu thô dưới dạng:

```python
list[dict[str, Any]]
```

#### Nguyên tắc thiết kế

Repository tuân thủ **Single Responsibility Principle (SRP)**:

* Chỉ chịu trách nhiệm giao tiếp với database.
* Không thực hiện DTO parsing.
* Không chứa business logic.
* Không thực hiện data transformation ở tầng Service.

#### Cải tiến

* Chuẩn hóa việc sử dụng `async/await`.
* Kế thừa `BaseRepository`.
* Tách biệt rõ ràng Database I/O khỏi Business Logic.

---

### 🔹 Layer 2: DTO & Service

**File:** `src/backend/app/services/github_retrieval.py`

### `GitHubProjectDTO`

DTO chịu trách nhiệm biểu diễn thông tin project sau khi đã được validate và normalize.

Các field chính:

```text
name
language
description
topics
lexical_score
```

---

### `GitHubRetrievalService`

Contract chính:

```python
retrieve_relevant_projects(
    candidate_uuid,
    query,
    top_k=3
) -> list[GitHubProjectDTO]
```

Service chịu trách nhiệm:

1. Validate input.
2. Gọi Repository.
3. Parse dữ liệu raw từ RPC.
4. Normalize dữ liệu.
5. Bỏ qua các project bị lỗi.
6. Trả về danh sách `GitHubProjectDTO` hợp lệ.

---

## 2. Defensive Programming

Service được triển khai theo hướng **defensive programming** để tránh một record lỗi làm ảnh hưởng toàn bộ request.

### 2.1. Guard Clauses

Service kiểm tra các trường hợp input không hợp lệ:

* `candidate_uuid` rỗng.
* `query` rỗng.
* `top_k <= 0`.

Trong các trường hợp trên, Service trả về:

```python
[]
```

ngay lập tức mà không gọi xuống Repository.

---

### 2.2. Per-item Isolation

Nếu một project trong danh sách trả về từ RPC có dữ liệu không hợp lệ hoặc xảy ra lỗi trong quá trình parsing:

* Service log warning.
* Bỏ qua project đó.
* Tiếp tục xử lý các project còn lại.

Điều này giúp đảm bảo:

> Một record lỗi không làm fail toàn bộ request.

---

### 2.3. Flexible Field Fallback

Service hỗ trợ nhiều cách đặt tên field có thể được trả về từ SQL RPC.

| DTO Field       | Supported RPC Fields               |
| --------------- | ---------------------------------- |
| `name`          | `repo_name` → `name`               |
| `lexical_score` | `score` → `rank` → `lexical_score` |

Cách mapping này giúp Service ít phụ thuộc hơn vào implementation cụ thể của SQL RPC.

---

### 2.4. Data Cleaning

Service tự động làm sạch dữ liệu `topics`.

Các giá trị:

* `None`
* Empty value
* Các phần tử không hợp lệ

sẽ được loại bỏ trước khi tạo `GitHubProjectDTO`.

Ví dụ:

```python
[
    "python",
    None,
    "fastapi",
    "",
]
```

sẽ được normalize thành:

```python
[
    "python",
    "fastapi",
]
```

---

# 3. Kết quả Kiểm thử (Test Results)

**Test file:**

```text
tests/services/test_github_retrieval_service.py
```

---

## 🧪 3.1. Unit Tests

### Test class

```text
TestGitHubRetrievalServiceUnit
```

### Số lượng

**8 test cases**

Các test chạy độc lập với database bằng Mock Repository.

### Nội dung kiểm tra

#### 1. Success Flow

Kiểm tra việc mapping chính xác từ raw dictionary sang:

```python
GitHubProjectDTO
```

---

#### 2. Guard Clauses

Kiểm tra Service trả về:

```python
[]
```

khi:

* `candidate_uuid` rỗng.
* `query` rỗng.
* `top_k <= 0`.

---

#### 3. Exception Handling

Kiểm tra Service xử lý an toàn khi Repository gặp lỗi hoặc mất kết nối database.

Expected result:

```python
[]
```

thay vì làm crash toàn bộ request.

---

#### 4. Dirty Data Parsing

Kiểm tra khả năng xử lý dữ liệu không sạch:

* Clean `topics`.
* Fallback giữa các field name khác nhau.
* Bỏ qua item thiếu `name`.
* Không để một item lỗi ảnh hưởng đến các item hợp lệ khác.

---

# 4. 🔌 Integration Test

### Kết quả

```text
PASSED [100%]
```

### Thời gian thực thi

```text
~3.05s
```

### Xác nhận

Integration test đã xác nhận connection thực tế giữa toàn bộ flow:

```text
Backend Python
      ↓
GitHubRetrievalService
      ↓
GitHubProfileRepository
      ↓
Supabase RPC Function
      ↓
Supabase Database
```

hoạt động chính xác.

Đây là bằng chứng rằng Repository không chỉ pass unit test với mock mà còn có thể giao tiếp thành công với **Supabase RPC thực tế**.

---

# 5. Hướng dẫn Sử dụng (Usage Guide)

## 💻 5.1. Gọi Service trong Backend Code

Import các component:

```python
from src.backend.app.repositories.github_profile import GitHubProfileRepository
from src.backend.app.services.github_retrieval import GitHubRetrievalService
```

### Cách 1 — Sử dụng Repository mặc định

```python
retrieval_service = GitHubRetrievalService()
```

Service sẽ tự động sử dụng Repository mặc định.

---

### Cách 2 — Dependency Injection

Có thể inject Repository tùy chỉnh khi cần:

```python
repo = GitHubProfileRepository(session=custom_session)

retrieval_service = GitHubRetrievalService(
    repository=repo
)
```

Cách này hữu ích cho:

* Unit testing.
* Custom database session.
* Dependency injection.
* Mocking Repository.

---

## 5.2. Retrieve Relevant Projects

Ví dụ:

```python
candidate_uuid = "00000000-0000-0000-0000-000000000000"

job_query = "FastAPI Python LLM Supabase"

projects: list[GitHubProjectDTO] = (
    await retrieval_service.retrieve_relevant_projects(
        candidate_uuid=candidate_uuid,
        query=job_query,
        top_k=3,
    )
)
```

---

## 5.3. Sử dụng kết quả

Có thể iterate qua danh sách project:

```python
for proj in projects:
    print(
        f"Project: {proj.name} | "
        f"Score: {proj.lexical_score}"
    )

    print(
        f"Tech: {proj.language} | "
        f"Topics: {proj.topics}"
    )
```

Ví dụ output:

```text
Project: ai-job-matcher | Score: 0.92
Tech: Python | Topics: ['fastapi', 'llm', 'supabase']

Project: candidate-platform | Score: 0.84
Tech: Python | Topics: ['django', 'postgresql']
```

---

# 6. Cách chạy Test

## 🧪 6.1. Chỉ chạy Unit Tests

Unit tests không cần kết nối database thật nên tốc độ chạy rất nhanh.

```bash
python -m pytest tests/services/test_github_retrieval_service.py -k "TestGitHubRetrievalServiceUnit" -v
```

---

## 🔌 6.2. Chạy Integration Test

Integration test yêu cầu kết nối đến Supabase thật.

```bash
RUN_INTEGRATION_TESTS=true python -m pytest tests/services/test_github_retrieval_service.py -v
```

---

## 🧪 6.3. Chạy toàn bộ Test File

Nếu muốn chạy cả Unit Tests và Integration Tests:

```bash
python -m pytest tests/services/test_github_retrieval_service.py -v
```

> **Lưu ý:** Integration test chỉ được thực thi khi environment variable `RUN_INTEGRATION_TESTS=true` được bật.

---

# 7. Architecture Overview

Flow tổng thể của module:

```text
                    ┌──────────────────────┐
                    │      Job Query       │
                    │ "FastAPI Python LLM" │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ GitHubRetrievalService│
                    │                      │
                    │ - Validate input     │
                    │ - Business logic     │
                    │ - DTO mapping        │
                    │ - Data cleaning      │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ GitHubProfileRepository│
                    │                      │
                    │ search_projects_     │
                    │ lexically()          │
                    └──────────┬───────────┘
                               │
                               │ RPC
                               ▼
                    ┌──────────────────────┐
                    │      Supabase        │
                    │                      │
                    │ search_github_       │
                    │ projects_lexically   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Raw Project Results  │
                    │     list[dict]       │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   GitHubProjectDTO   │
                    │                      │
                    │ - name               │
                    │ - language           │
                    │ - description        │
                    │ - topics             │
                    │ - lexical_score      │
                    └──────────────────────┘
```

---

# 8. Design Principles

Module hiện tại tuân thủ các nguyên tắc thiết kế chính:

### Single Responsibility Principle

Repository chỉ phụ trách Database I/O.

Service chịu trách nhiệm Business Logic và Data Transformation.

DTO chịu trách nhiệm cấu trúc dữ liệu đầu ra.

---

### Dependency Injection

Service hỗ trợ inject Repository:

```python
GitHubRetrievalService(
    repository=repository
)
```

Điều này giúp việc testing và thay thế implementation dễ dàng hơn.

---

### Defensive Programming

Input và database output đều được kiểm tra trước khi sử dụng.

Một record lỗi không làm fail toàn bộ operation.

---

### Separation of Concerns

Architecture được phân tách thành:

```text
Repository
    ↓
Data Access

Service
    ↓
Business Logic + Validation + Mapping

DTO
    ↓
Validated Output
```

---

# 9. Current Status

| Component                   | Status      |
| --------------------------- | ----------- |
| Repository RPC Integration  | ✅ Completed |
| `search_projects_lexically` | ✅ Completed |
| `GitHubProjectDTO`          | ✅ Completed |
| `GitHubRetrievalService`    | ✅ Completed |
| Input Guard Clauses         | ✅ Completed |
| Per-item Error Isolation    | ✅ Completed |
| Flexible Field Mapping      | ✅ Completed |
| Topics Data Cleaning        | ✅ Completed |
| Unit Tests                  | ✅ 8 Tests   |
| Integration Test            | ✅ Passed    |
| Supabase RPC Connection     | ✅ Verified  |

---

# 10. Conclusion

Module **GitHub Project Retrieval** đã hoàn thành implementation và validation.

Đặc biệt, Integration Test đã chạy thành công với kết quả:

```text
PASSED [100%]
```

Điều này xác nhận toàn bộ flow:

```text
Python Backend
→ GitHubRetrievalService
→ GitHubProfileRepository
→ Supabase RPC
→ Supabase Database
```

đang hoạt động end-to-end.

Module hiện đã sẵn sàng để được tích hợp vào các workflow tiếp theo của hệ thống, chẳng hạn như **Candidate Retrieval**, **Job Matching** hoặc **Candidate Ranking**.
