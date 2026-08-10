# Báo cáo review nhánh `ai-agent`

> **Ngày review:** 2026-08-04
> **Nhánh:** `ai-agent` @ `4c3be11`
> **So sánh với:** `main`
> **Phạm vi:** kiểm tra xem luồng AI xử lý CV đã hoàn thiện chưa (chỉ đọc code, không sửa)
> **Cách verify:** đọc code + chạy thật (`pytest`, import smoke test, gọi trực tiếp mapper/service) trong `venv` của repo

---

## 1. Kết luận nhanh

Phát biểu "đã làm xong AI để process CV" **không chính xác**.

Cái đã làm được là **khung agent tìm kiếm ứng viên cho recruiter** (LangGraph 5 node + hybrid search + ranking + LLM ra quyết định). Phần này thiết kế khá bài bản, tách node / service / repository rõ ràng, đáng giữ lại.

Nhưng **luồng xử lý CV lúc candidate nộp hồ sơ** (job link → Azure `/share` → parse → AI scoring/analyze → enrich GitHub/LinkedIn) thì:

- Chỉ có đúng **1 bước** được implement: parse PDF.
- File duy nhất mang tên "xử lý CV" — `resumeUploading_pipeline.py` — **không import nổi**, và kể cả sửa import xong vẫn còn 3 lỗi chặn phía sau. Tức là nó chưa từng chạy qua lần nào.
- Nhánh không có API layer và không có `main.py` → không có gì để deploy hoặc demo end-to-end.

---

## 2. Thống kê nhánh

| Mục | Số liệu |
|---|---|
| Commit so với `main` | 10 commit, tác giả `tnhoang0611`, 18/07 → 03/08/2026 |
| Thay đổi | 126 file, +6.773 / −724 dòng |
| Code Python thực tế trong `src/backend/app` | ~2.400 dòng |
| Test | 7 test (đều **skipped**), 1 script E2E (**lỗi collect**) |

### 2.1. Phần thực sự có code

| File | Dòng | Nội dung |
|---|---|---|
| `app/agents/state.py` | 424 | Toàn bộ Pydantic state cho agent (Mission, SearchRequirement, CandidateContext, Reflection, RecruiterDecision…) |
| `app/agents/graph.py` + `nodes/` + `router.py` | ~320 | LangGraph 5 node: planner / interaction / retrieval / reflection / recruiter_decision |
| `app/repositories/enrichment_repository.py` | 218 | CRUD `enrichment_profiles` trên Supabase REST |
| `app/services/llm_provider.py` | 143 | Abstraction LLM + `GroqProvider` có structured output |
| `app/services/candidate_search_service.py` | 117 | Hard filter → lexical → semantic → fusion → hydrate |
| `app/repositories/embedding_repository.py` | 107 | CRUD `embeddings` + RPC vector search |
| `app/repositories/candidate_search_repository.py` | 101 | 3 RPC: skills filter, lexical, semantic |
| `app/repositories/resume_repository.py` | 99 | CRUD `resumes` |
| `app/services/ranking_service.py` | 70 | Weighted fusion 0.2 lexical / 0.4 summary / 0.4 experience |
| `app/services/parser_service.py` | 42 | Parse + cleanup PDF bằng PyMuPDF |
| `tests/test_e2e.py` | 220 | Script chạy tay E2E agent search |

### 2.2. File rỗng 0 byte (khai báo nhưng chưa viết)

```
src/backend/main.py
src/backend/app/api/candidate.py
src/backend/app/api/interview.py
src/backend/app/api/recruiter.py
src/backend/app/core/config.py
src/backend/app/core/logging.py
src/backend/app/core/security.py
src/backend/app/services/calendar_service.py
src/backend/app/agents/tools/github_search.py
src/backend/app/agents/tools/search_database.py
src/backend/app/agents/tools/semantic_ranking.py
src/backend/app/agents/tools/explanation.py
```

Ngoài ra toàn bộ `src/backend/modules/*` (ingestion, enrichment, portfolio-enrich, ai-analytics, notification, review, scheduling, mcp-host, admin, auth, shared) **rỗng hoàn toàn** trên nhánh này — chỉ còn thư mục và `__pycache__` sót lại từ nhánh khác.

---

## 3. Đối chiếu với pipeline nghiệp vụ mong muốn

> Pipeline mong muốn: candidate upload CV qua link của job → job được đẩy về `/share` trên Azure → file được parse → đưa vào AI để scoring / ranking / analyze → song song lấy link GitHub + LinkedIn để enrich.

| # | Bước | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | Candidate upload CV qua link job | ❌ Không có | `grep -niE "\bjob\b\|application"` trong `src/backend/app` = **0 kết quả**. Không có bảng job/job_posting/application. Không có endpoint nào (API rỗng 0 byte) |
| 2 | Đẩy file lên Azure `/share` | ❌ Không có | 0 dòng code Azure trong `src/`. Chỉ xuất hiện trong `docs/` và ở nhánh khác — `services/ingestion_gateway.py` chỉ tồn tại trong worktree của nhánh khác, không có trên `ai-agent` |
| 3 | Parse file CV | ⚠️ Có nhưng hẹp | `app/services/parser_service.py` — chỉ PDF (PyMuPDF). Không xử lý `.docx` dù `requirements.txt` đã khai `python-docx` |
| 4 | AI analyze / scoring CV | ❌ Chết ngay khi gọi | `app/services/llm_service.py:33` gọi `provider.generate_text()` — `GroqProvider` **chỉ có method `invoke`** |
| 5 | Ranking | ⚠️ Có, nhưng khác luồng | `RankingService.fuse_and_rank` phục vụ luồng **recruiter tìm ứng viên**, không phải chấm điểm CV ↔ job lúc upload |
| 6 | Enrich GitHub / LinkedIn | ❌ Không có | Chỉ là cột DB + field trong state. `tools/github_search.py` = 0 byte. `.env` có `GITHUB_API_TOKEN`, `APIFY_API_TOKEN` nhưng **không dòng code nào đọc** |

**Nhận xét:** cái được xây là agent cho **recruiter query → tìm ứng viên**. Đây là chiều ngược lại của pipeline nghiệp vụ mô tả (**CV vào → chấm điểm theo job**). Hai luồng này dùng chung được embedding + ranking, nhưng entry point, dữ liệu đầu vào và output hoàn toàn khác nhau.

---

## 4. Lỗi chặn (blocking) — đã verify bằng cách chạy thật

### B1. `resumeUploading_pipeline` không import được

```
ImportError: cannot import name 'ResumeEmbeddingRepository'
from 'backend.app.repositories.embedding_repository'
```

- `resumeUploading_pipeline.py:1` import `ResumeEmbeddingRepository` — class thật tên `EmbeddingRepository`.
- `resumeUploading_pipeline.py:8` import `ResumeAnalysisRepository` từ `enrichment_repository` — class này **không tồn tại**, file chỉ có `EnrichmentRepository`.

### B2. `LLMService.analyze_resume` chắc chắn `AttributeError`

`llm_service.py:33` gọi `self.provider.generate_text(prompt)`. Verify runtime:

```
GroqProvider methods: ['invoke']
```

Nghĩa là **toàn bộ bước phân tích CV bằng LLM chưa từng chạy được**.

### B3. Sai chữ ký hàm `create_resume`

- Pipeline gọi: `create_resume(user_id, parsed_text, file_path)` — 3 tham số.
- Hàm thật: `create_resume(candidate_uuid: str, filename: str, file_path: str, text_content: str)` — 4 tham số, **thứ tự khác hẳn**.

→ `TypeError` ngay cả khi qua được B1/B2.

### B4. Trộn 2 kiểu truy cập DB

- `resumeUploading_pipeline.py:49-70` dùng SQLAlchemy: `session.begin_nested()`, `session.flush()`, `session.add()`, `session.commit()`.
- Nhưng repository đã refactor sang **Supabase REST** (`self.client.table(...).insert(...)`).
- `repositories/base.py:9`: `self.client = session or supabase` — truyền `AsyncSession` vào là gán nhầm thành client.

Đây là hệ quả của việc refactor sang Supabase mà **không cập nhật pipeline theo**.

### B5. `candidateSearching_pipeline` gọi method không tồn tại

`candidateSearching_pipeline.py:32` gọi `self.ranking_service.rank(...)`. Verify runtime:

```
RankingService methods: ['fuse_and_rank']
```

### B6. Môi trường không chạy được

- `langgraph` **chưa cài** trong `venv` → `pytest` collect `tests/test_e2e.py` fail với `ModuleNotFoundError: No module named 'langgraph'`.
- `requirements.txt` **thiếu `groq` và `supabase`**, dù code phụ thuộc trực tiếp vào cả hai.

### B7. Thiếu biến môi trường

- `.env` **không có `GROQ_API_KEY`** — `GroqProvider.__init__` đọc `os.getenv("GROQ_API_KEY")`.
- `.env` chỉ có `SUPABASE_SERVICE_KEY`, trong khi `tests/repositories/conftest.py`, `tests/integration/rpc/conftest.py` và `tests/test_e2e.py` đều đòi **`SUPABASE_SERVICE_ROLE_KEY`**.

Kết quả chạy `pytest`:

```
7 skipped
ERROR tests/test_e2e.py  (ModuleNotFoundError: langgraph)
```

Tức là **chưa test nào thực sự chạy** trên máy này.

### B8. Import lẫn 2 gốc module

Thống kê trong `src/backend/app`, `tests/`, `test/`:

| Gốc import | Số lần |
|---|---|
| `src.backend.app.*` | 86 |
| `backend.app.*` | 55 |

Vì không có `__init__.py` ở đâu cả (namespace package) và `tests/test_e2e.py` add cả 2 path vào `sys.path`, nên **cùng một class bị load thành 2 module khác nhau**:

- 2 SQLAlchemy `DeclarativeBase` registry riêng biệt.
- `isinstance()` giữa 2 nhánh luôn `False`.
- Enum so sánh chéo không bằng nhau.

Đây là bug tiềm ẩn khó debug nhất trong nhánh này.

---

## 5. Lỗi logic (chạy được nhưng ra kết quả sai)

### L1. `CandidateMapper` duyệt chuỗi theo từng ký tự — **nghiêm trọng**

`models/enrichment_profile.py:34` khai báo `experience` kiểu `Text` (chuỗi), nhưng `mappers/candidate_mapper.py:37-38` làm:

```python
raw_experiences = getattr(profile, "experience", []) or []
experiences = cls._parse_experiences(raw_experiences)   # for exp in raw_experiences
```

Chạy thử với `experience="3 years at ACME"`:

```
experiences parsed from a TEXT field -> 15 items
```

→ 15 `ExperienceDTO` rỗng, mỗi ký tự một cái. **Toàn bộ dữ liệu kinh nghiệm gửi cho LLM ra quyết định là rác.**

### L2. `strengths` / `weaknesses` luôn rỗng

`EnrichmentProfile` **không có 2 cột này**. `candidate_mapper.py:45-46` dùng `getattr(profile, "strengths", [])` → luôn trả `[]`. Trong khi `recruiter_prompt.md` yêu cầu LLM đánh giá dựa trên điểm mạnh/yếu.

### L3. `github_summary` / `linkedin_summary` luôn `None`

DB chỉ lưu URL (`github`, `linkedin` kiểu `String(512)`), không có cột summary. `candidate_mapper.py:48-49` `getattr` → luôn `None`. Prompt recruiter lại nói "including GitHub/LinkedIn insights".

### L4. Observation gửi cho Reflection luôn sai số liệu

`agents/nodes/retrieval.py:53-54`:

```python
"lexical_hits": sum(1 for c in candidates if getattr(c, 'is_lexical', False)),
"semantic_hits": sum(1 for c in candidates if getattr(c, 'is_semantic', False)),
```

`CandidateSearchResultDTO` **không có** field `is_lexical` / `is_semantic` → cả hai **luôn = 0**. Reflection node ra quyết định retry dựa trên metric sai.

### L5. Prompt lệch schema

`prompts/planner_prompt.md` hướng dẫn set status `"needed"` hoặc `"not_enough"`, và đặt câu hỏi vào field `suggestion`. Nhưng `state.py`:

- `ClarificationDetail.status` là `Literal["enough", "not_enough"]` → `"needed"` fail validation.
- `QueryAssessment` **không có** field `suggestion`.

### L6. Nguy cơ lặp vô hạn planner ↔ interaction

`router.py:4-20` (`route_after_planner`) **không kiểm tra** `state.iteration` / `state.max_steps`. Chỉ `route_after_reflection` mới có guard. Nếu LLM liên tục trả `not_enough`, vòng planner → interaction → planner chạy mãi.

### L7. `process_batch` gọi hàm async không `await`

`resumeUploading_pipeline.py:73-78` — `process` là `async def`, `process_batch` là `def` thường và gọi trực tiếp → trả về list coroutine chưa chạy.

### L8. `embed_resume` giả định cấu trúc dữ liệu không được đảm bảo

`embedding_service.py:33-36` làm `exp["description"]` cho từng phần tử `analysis.experience`. Nhưng prompt trong `llm_service.py:18-24` chỉ yêu cầu `"experience": []` — **không ràng buộc key nào bên trong**. → `KeyError` / `TypeError` rất dễ xảy ra.

### L9. Code thừa trong pipeline

`resumeUploading_pipeline.py:39-45` tạo một `ResumeAnalysis` rồi ghi đè ngay ở dòng 55. Ngoài ra dòng 7 import `ResumeAnalysis` (Pydantic schema) nhưng dòng 10 import `ResumeAnalysis` (SQLAlchemy model) đè lên — cùng tên, khác class.

---

## 6. Thiếu về hạ tầng / khả năng tái lập

- **3 RPC function không có trong repo:** `search_similar_embeddings`, `search_profiles_lexically`, `get_candidate_ids_by_skills` chỉ được gọi từ code, còn định nghĩa SQL thì không nằm ở đâu cả. `infrastructure/postgres/init.sql` chỉ có đúng 1 dòng `CREATE EXTENSION`. → Người khác clone repo về **không dựng lại được DB**.
- **Không có migration** (Alembic) cho các bảng mới: `candidates`, `enrichment_profiles`, `embeddings`, `resumes`.
- Tài liệu test (`docs/test/`) ghi nhận test đã PASS trên Supabase cá nhân, nhưng không kèm SQL để tái lập môi trường đó.

---

## 7. Đề xuất ưu tiên xử lý

| Ưu tiên | Việc | Lý do |
|---|---|---|
| P0 | Thống nhất **một gốc import** (`src.backend.app` hoặc `backend.app`) + thêm `__init__.py` | Chặn class bị load 2 lần, 2 SQLAlchemy registry |
| P0 | Thống nhất **một kiểu truy cập DB** (Supabase REST hoặc SQLAlchemy, không trộn) | B4 — pipeline hiện không thể chạy |
| P0 | Sửa `LLMService` gọi `provider.invoke(system_prompt, text, response_model=ResumeAnalysis)` và **bỏ hẳn phần tự parse JSON thủ công** | B2 — `GroqProvider` đã có structured output sẵn, không cần strip markdown bằng regex |
| P0 | Sửa import + chữ ký hàm trong `resumeUploading_pipeline.py` | B1, B3, B5 |
| P1 | Sửa `CandidateMapper._parse_experiences` + bổ sung cột `strengths`/`weaknesses`/`*_summary` vào `enrichment_profiles` | L1, L2, L3 — đang bơm dữ liệu rác vào LLM |
| P1 | Bổ sung `groq`, `supabase`, `langgraph` vào `requirements.txt`; thêm `GROQ_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` vào `.env.example` | B6, B7 |
| P1 | Commit SQL của 3 RPC + migration các bảng mới vào repo | Mục 6 |
| P2 | Đồng bộ prompt với schema (`"needed"`, `suggestion`) | L5 |
| P2 | Thêm guard `max_steps` vào `route_after_planner` | L6 |
| P2 | Sửa `lexical_hits` / `semantic_hits` hoặc bỏ khỏi Observation | L4 |
| P3 | Xây phần còn thiếu của pipeline nghiệp vụ: endpoint upload theo job, đẩy Azure Blob/Share, worker enrich GitHub/LinkedIn, scoring CV ↔ job | Mục 3 — hiện chưa có |

---

## 8. Cách tái lập kết quả review

```bash
git checkout ai-agent

# Xem file rỗng
find src/backend/app -name "*.py" -size 0

# Smoke test import
PYTHONPATH=".:src" venv/bin/python -c \
  "import src.backend.app.pipelines.resumeUploading_pipeline"

# Chạy test
PYTHONPATH=".:src" venv/bin/python -m pytest tests -q

# Kiểm tra bug mapper
PYTHONPATH=".:src" venv/bin/python -c "
from backend.app.mappers.candidate_mapper import CandidateMapper
class P: candidate_uuid='u1'; summary='s'; skills=[]; experience='3 years at ACME'
print(len(CandidateMapper.to_search_result_dto(P(), 0.9).experiences))
"
```
