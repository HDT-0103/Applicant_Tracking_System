Quá đẹp. Theo mình thì **Retrieval Layer là trái tim của ATS**, nên đừng vội code `RetrievalNode` trước. Mình sẽ tách thành nhiều lớp nhỏ để sau này dễ test và thay đổi.

---

# Sprint hiện tại

```
Planner
    │
    ▼
SearchRequirement
    │
    ▼
SearchService
    │
    ▼
CandidateContext[]
    │
    ▼
RetrievalNode
```

Tức là **Node chỉ orchestration**, còn business logic nằm trong Service.

---

# Task 1 — CandidateSearchRepository

Đây là tầng gọi Supabase RPC.

Nó chỉ wrap 3 RPC.

```
CandidateSearchRepository

get_candidate_ids_by_skills()

search_profiles_lexically()

search_similar_embeddings()
```

Không có ranking.

Không có merge.

Không có score.

Không có embedding.

Repository chỉ trả raw data.

Ví dụ

```
skills
↓

candidate ids
```

```
text

↓

lexical results
```

```
embedding

↓

semantic results
```

---

# Task 2 — Score Fusion

Đây là class mới.

Ví dụ

```
FusionService
```

input

```
lexical result

semantic result
```

output

```
candidate score
```

Ví dụ

```
semantic

0.92

lexical

0.30

↓

0.7*0.92

+

0.3*0.30
```

Sau này đổi thuật toán chỉ sửa đúng class này.

---

# Task 3 — Search Service ⭐⭐⭐

Đây là phần quan trọng nhất.

```
SearchService
```

Nó nhận

```
SearchRequirement
```

và orchestration toàn bộ pipeline.

Flow

```
Hard Filter

↓

Lexical Search

↓

Embedding

↓

Semantic Search

↓

Fusion

↓

Ranking

↓

Top K
```

Đây là nơi dùng

```
EmbeddingService
```

và

```
CandidateSearchRepository
```

---

Pseudo

```
search_candidates()

↓

hard filter

↓

candidate ids

↓

lexical search

↓

embed summary

↓

semantic summary

↓

embed experience

↓

semantic experience

↓

fusion

↓

sort

↓

top k
```

---

# Task 4 — Mapper

RPC trả

```
dict
```

Nhưng RecruiterNode cần

```
CandidateContext
```

Nên nên có mapper riêng.

Ví dụ

```
CandidateMapper
```

```
database row

↓

CandidateContext
```

Đừng map trong RetrievalNode.

---

# Task 5 — RetrievalNode

Lúc này RetrievalNode cực kỳ nhỏ.

```
Planner

↓

SearchRequirement

↓

SearchService.search()

↓

CandidateContext[]

↓

save state
```

Tầm khoảng 20-30 dòng.

---

# Kiến trúc cuối

```
agents/
│
├── nodes/
│      RetrievalNode
│
services/
│
├── SearchService
├── FusionService
├── EmbeddingService
│
repositories/
│
├── CandidateSearchRepository
│
mapper/
│
└── CandidateMapper
```

---

# Theo mình nên code đúng thứ tự này

### Bước 1 (15 phút)

✅ `CandidateSearchRepository`

Wrap 3 RPC.

---

### Bước 2 (15 phút)

✅ `FusionService`

Viết score fusion.

---

### Bước 3 (1-2 giờ)

✅ `SearchService`

Đây là phần lớn nhất.

---

### Bước 4 (15 phút)

✅ `CandidateMapper`

---

### Bước 5 (10 phút)

✅ `RetrievalNode`

---

Mình còn đề xuất thêm một cải tiến nhỏ: **đừng để `SearchService` trả `CandidateContext` ngay**. Hãy để nó trả một model trung gian như `SearchResult` (gồm `candidate_uuid`, `semantic_score`, `lexical_score`, `final_score`, `matched_fields`, ...). Sau đó `CandidateMapper` mới chuyển `SearchResult` thành `CandidateContext`. Điều này giúp sau này bạn dễ debug pipeline Hybrid Search vì có thể quan sát toàn bộ điểm số trước khi đưa vào LLM của `RecruiterDecisionNode`. Đây là cách nhiều hệ thống production tách tầng retrieval và tầng AI reasoning.
