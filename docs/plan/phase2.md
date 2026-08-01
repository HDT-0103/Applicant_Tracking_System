# RetrievalNode

## Mục đích

`RetrievalNode` là một node trong **LangGraph**, chịu trách nhiệm tìm kiếm ứng viên dựa trên yêu cầu (`search_requirement`) được lưu trong `ATSState`.

Node này đóng vai trò kết nối giữa graph và `CandidateSearchService`, sau đó cập nhật kết quả tìm kiếm vào state để các node tiếp theo sử dụng.

---

## Dependencies

```python
from src.backend.app.agents.state import ATSState
from src.backend.app.services.candidate_search_service import CandidateSearchService
```

- **ATSState**
  - Lưu toàn bộ trạng thái của workflow.
  - Chứa thông tin `candidate_search`.

- **CandidateSearchService**
  - Service thực hiện việc truy vấn và tìm kiếm ứng viên.
  - Trả về danh sách `CandidateContext`.

---

## Constructor

```python
def __init__(self, search_service: CandidateSearchService):
```

### Parameters

| Tên | Kiểu | Mô tả |
|------|------|-------|
| `search_service` | `CandidateSearchService` | Service dùng để thực hiện tìm kiếm ứng viên. |

---

## Workflow

```text
ATSState
    │
    ▼
candidate_search.search_requirement
    │
    ├── Empty
    │      ▼
    │  candidates = []
    │      ▼
    │   Return state
    │
    └── Has requirement
           ▼
CandidateSearchService.search()
           ▼
List[CandidateContext]
           ▼
state.candidate_search.candidates
           ▼
Return updated state
```

---

## Processing Flow

### Bước 1: Đọc yêu cầu tìm kiếm

```python
requirement = state.candidate_search.search_requirement
```

Lấy thông tin yêu cầu tìm kiếm từ state.

---

### Bước 2: Kiểm tra requirement

Nếu requirement rỗng:

```python
state.candidate_search.candidates = []
return state
```

Không gọi service tìm kiếm và trả về state ngay.

---

### Bước 3: Tìm kiếm ứng viên

Nếu có requirement:

```python
candidates = await self.search_service.search(
    requirement=requirement,
    top_k=10,
)
```

Thực hiện truy vấn đến `CandidateSearchService`.

Tham số:

| Parameter | Value | Ý nghĩa |
|------------|-------|----------|
| `requirement` | search requirement | Điều kiện tìm kiếm |
| `top_k` | `10` | Số lượng ứng viên tối đa trả về |

---

### Bước 4: Cập nhật state

```python
state.candidate_search.candidates = candidates
```

Lưu danh sách ứng viên tìm được vào state.

---

### Bước 5: Trả về state

```python
return state
```

State sau khi được cập nhật sẽ được chuyển sang node tiếp theo trong LangGraph.

---

## Input

```python
ATSState
```

Trong đó sử dụng:

```python
state.candidate_search.search_requirement
```

Ví dụ:

```python
CandidateRequirement(
    skills=["Python", "FastAPI"],
    experience=3,
    location="HCM"
)
```

---

## Output

Cập nhật:

```python
state.candidate_search.candidates
```

Ví dụ:

```python
[
    CandidateContext(...),
    CandidateContext(...),
    CandidateContext(...),
]
```

---

## Sequence Diagram

```text
LangGraph
     │
     ▼
RetrievalNode
     │
     ▼
Read search_requirement
     │
     ├── Empty
     │      ▼
     │  candidates = []
     │      ▼
     │ Return state
     │
     └── Not Empty
            ▼
CandidateSearchService.search()
            ▼
 List[CandidateContext]
            ▼
 Update state.candidate_search.candidates
            ▼
 Return ATSState
```

---

## Trách nhiệm của RetrievalNode

- Đọc `search_requirement` từ `ATSState`.
- Kiểm tra yêu cầu tìm kiếm có tồn tại hay không.
- Gọi `CandidateSearchService.search()`.
- Nhận danh sách `CandidateContext`.
- Cập nhật `state.candidate_search.candidates`.
- Trả về `ATSState` để workflow tiếp tục thực thi.

---

## Pseudocode

```text
function RetrievalNode(state):

    requirement = state.candidate_search.search_requirement

    if requirement is empty:
        state.candidate_search.candidates = []
        return state

    candidates = CandidateSearchService.search(
        requirement,
        top_k=10
    )

    state.candidate_search.candidates = candidates

    return state
```