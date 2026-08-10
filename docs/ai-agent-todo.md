# Nhánh `ai-agent` — danh sách việc còn thiếu

> **Gửi:** người phụ trách nhánh `ai-agent`
> **Ngày:** 2026-08-04
> **Nhánh review:** `ai-agent` @ `4c3be11`, đối chiếu với `feature/admin-page` @ `2e22bb7`
> **Cách kiểm chứng:** đọc code + chạy thật (`pytest`, import smoke test, merge thử trong worktree tách riêng). Không sửa gì trên hai nhánh.
>
> Báo cáo chi tiết: [`ai-agent-branch-review.md`](ai-agent-branch-review.md) · [`merge-ai-agent-into-admin-page-report.md`](merge-ai-agent-into-admin-page-report.md)

---

## Ghi nhận trước

Khung agent LangGraph 5 node, `state.py` khá đầy đủ, tách service / repository / mapper rõ ràng, hybrid search (hard filter → lexical → semantic → fusion) là hướng đúng. Phần này đáng giữ.

**Nhưng hiện tại code chưa chạy được lần nào.** Cụ thể bên dưới.

---

## A. 4 lỗi làm chết luồng xử lý CV (sửa trước tiên)

**A1.** `app/pipelines/resumeUploading_pipeline.py:1,8` — import `ResumeEmbeddingRepository` và `ResumeAnalysisRepository`, **cả hai class đều không tồn tại**. Tên thật là `EmbeddingRepository` và `EnrichmentRepository`. File `ImportError` ngay dòng đầu:

```
ImportError: cannot import name 'ResumeEmbeddingRepository'
from 'backend.app.repositories.embedding_repository'
```

**A2.** `app/services/llm_service.py:33` gọi `provider.generate_text()` — `GroqProvider` bản nhánh này **chỉ có `invoke()`**.
→ Sửa `LLMService` dùng `invoke(system_prompt, text, response_model=ResumeAnalysis)` và **bỏ luôn đoạn strip markdown + `json.loads` thủ công**, vì `invoke` đã có structured output sẵn.

**A3.** Pipeline gọi `create_resume(user_id, parsed_text, file_path)` — 3 tham số, sai thứ tự. Hàm thật:

```python
create_resume(candidate_uuid: str, filename: str, file_path: str, text_content: str)
```

**A4.** Pipeline vẫn dùng SQLAlchemy (`session.begin_nested()`, `session.add()`, `commit()`) trong khi repository đã chuyển sang Supabase REST. `repositories/base.py:9` gán thẳng `session` thành `self.client` — truyền `AsyncSession` vào là hỏng. Đây là hệ quả refactor sang Supabase mà quên cập nhật pipeline.

**Thêm:** `app/pipelines/candidateSearching_pipeline.py:32` gọi `ranking_service.rank()` — `RankingService` chỉ có `fuse_and_rank`.

---

## B. 3 lỗi logic khiến kết quả sai (chạy được nhưng ra rác)

**B1.** `app/mappers/candidate_mapper.py:37` — `EnrichmentProfile.experience` là kiểu `Text` (chuỗi) nhưng code làm `for exp in raw_experiences`. Test thử với chuỗi `"3 years at ACME"`:

```
experiences parsed from a TEXT field -> 15 items
```

→ 15 `ExperienceDTO` rỗng, mỗi ký tự một cái. **Toàn bộ dữ liệu kinh nghiệm gửi cho LLM đang là rác.**

**B2.** Bảng `enrichment_profiles` **không có cột** `strengths`, `weaknesses`, `github_summary`, `linkedin_summary` → mapper `getattr` luôn trả `[]` / `None`, trong khi `recruiter_prompt.md` lại yêu cầu LLM đánh giá dựa trên đúng mấy field đó.

**B3.** `app/agents/nodes/retrieval.py:53-54` đếm `lexical_hits` / `semantic_hits` bằng `getattr(c, 'is_lexical', False)` — DTO không có field này nên **luôn = 0**. Reflection node đang quyết định retry dựa trên số liệu sai.

**Thêm 2 cái nhỏ:**
- `prompts/planner_prompt.md` bảo LLM set status `"needed"` nhưng schema là `Literal["enough","not_enough"]` → fail validation.
- `agents/router.py` — `route_after_planner` không check `state.iteration` / `max_steps` → planner ↔ interaction có thể lặp vô hạn (chỉ `route_after_reflection` mới có guard).
- `process_batch` gọi hàm `async` mà không `await` → trả về list coroutine.

---

## C. Không chạy được vì môi trường / hạ tầng

**C1.** `requirements.txt` **thiếu `groq` và `supabase`** dù code import trực tiếp. `langgraph` cũng chưa cài trong venv → `tests/test_e2e.py` lỗi collect:

```
ModuleNotFoundError: No module named 'langgraph'
```

**C2.** `.env` **không có `GROQ_API_KEY`** (`GroqProvider` đọc biến này). Test và `test_e2e.py` đòi `SUPABASE_SERVICE_ROLE_KEY` nhưng `.env` chỉ có `SUPABASE_SERVICE_KEY`.

Kết quả chạy `pytest tests`:

```
7 skipped
ERROR tests/test_e2e.py
```

→ **Chưa test nào thực sự chạy.**

**C3.** SQL của 3 RPC — `search_similar_embeddings`, `search_profiles_lexically`, `get_candidate_ids_by_skills` — và migration cho `candidates` / `enrichment_profiles` / `embeddings` (+ extension `pgvector`) **không có trong repo**. `infrastructure/postgres/init.sql` chỉ có 1 dòng `CREATE EXTENSION`. Chúng chỉ tồn tại trên Supabase cá nhân → không ai dựng lại được môi trường.

---

## D. Bắt buộc làm trước khi merge vào `feature/admin-page`

Đã merge thử trong worktree tách riêng. Kết quả: **app chết hoàn toàn.**

| | `apps/main.py` | `backend/main.py` |
|---|---|---|
| Trước merge | ✅ 12 route | ✅ 6 route |
| Sau merge | ❌ `ImportError` | ❌ `ImportError` |

```
ImportError: cannot import name 'Requirement' from partially initialized module
'backend.app.models.requirement' (most likely due to a circular import)
```

Nguyên nhân đều từ phía `ai-agent`:

**D1. Thống nhất gốc import.** Nhánh đang lẫn **86 chỗ `src.backend.app.*`** và **55 chỗ `backend.app.*`**. Chuẩn của admin-page là `backend.app.*` (toàn bộ `modules/` và `apps/main.py` dùng gốc này) — cần đổi hết về đó.

Không đổi thì git tự merge việc đổi gốc import vào file model của admin-page, `Base` bị load thành 2 class → 2 SQLAlchemy registry → circular import + `InvalidRequestError: Table 'resume_embeddings' is already defined`.

**D2. Đừng ghi đè `models/enums.py`.** admin-page đã consolidate còn **đúng 3 role** (`admin` / `hr` / `tech_lead`, kèm `V005__consolidate_roles.sql`); bản ai-agent mang lại 6 role → **phá RBAC/ABAC đã làm xong**. `StatusType` cũng lệch (`done`/`canceled` ⟷ `confirmed`/`cancelled`) — đây là Postgres enum, sai là insert lỗi `22P02`.

→ Chỉ **thêm** `EnrichmentStatus`, `EmbeddingSource`, `CandidateStatus` vào; giữ nguyên `RoleType` và `StatusType` của admin-page.

**D3. Xoá 4 file `app/agents/tools/*.py` rỗng 0 byte trước khi merge.** Git nhận nhầm chúng là *rename* của 4 file docs và **xoá mất** (đã kiểm chứng, không báo conflict):

```
docs/analysis&design/mcp_architecture.md   → agents/tools/explanation.py
docs/management/deployment_guide.md        → agents/tools/github_search.py
docs/requirements/vision_agent_spec.md     → agents/tools/search_database.py
docs/test/agent_evaluation_report.md       → agents/tools/semantic_ranking.py
```

**D4. Đừng xoá** `app/mcp/*`, `app/database/init_db.sql`, `app/repositories/resume_analysis_repository.py`, `app/repositories/resume_embedding_repository.py` — admin-page đang dùng.

**D5. Giữ cả hai phiên bản** ở 2 chỗ bị đè:
- `LLMProvider`: giữ **cả** `generate_text()` (pipeline cũ dùng) lẫn `invoke()` (agent dùng).
- `RankingService`: giữ **cả** `rank()` lẫn `fuse_and_rank()`.
- Thống nhất 1 model: hiện ai-agent dùng `llama-3.1-8b-instant`, admin-page dùng `qwen/qwen3-32b`.

**D6. Quyết định schema chung** cho 2 bảng đang bị định nghĩa 2 kiểu:

| Bảng | admin-page | ai-agent |
|---|---|---|
| `resumes` | `(user_id, raw_text)` | `(candidate_uuid, filename, text_content)` |
| embedding | `resume_embeddings` + `requirement_embeddings` | `embeddings` (gộp, FK → `enrichment_profiles`) |

---

## E. Mắt xích lớn nhất còn thiếu

**Không có dòng code nào ghi vào `enrichment_profiles` và `embeddings` trong luồng upload thật.**

| Nhánh | Bảng Supabase đang dùng |
|---|---|
| `feature/admin-page` (luồng upload) | `candidates`, `users`, `jobs_posting`, `github_profiles`, `linkedin_profiles` |
| `ai-agent` (luồng search) | `candidates`, `users`, `resumes`, **`enrichment_profiles`**, **`embeddings`** |

Giao nhau chỉ có `candidates` và `users`. Mà `CandidateSearchService` lại **chỉ đọc từ `enrichment_profiles` + `embeddings`**.

→ Kể cả sửa hết A–D, **agent search vẫn luôn trả về 0 ứng viên** với dữ liệu thật; chỉ chạy được với dữ liệu seed tay (`tests/seed_candidates.py`).

**Việc cần làm:** sau khi CV được parse xong → tạo bản ghi `enrichment_profiles` → gọi `EmbeddingService.embed_text()` → ghi `embeddings`. Đây nên là việc làm trước tiên nếu muốn demo end-to-end.

---

## Thứ tự đề xuất

| Bước | Việc | Nhóm |
|---|---|---|
| 1 | Đổi hết về 1 gốc import `backend.app.*` | D1 |
| 2 | Sửa import + chữ ký hàm + `invoke()` trong pipeline | A1–A3 |
| 3 | Thống nhất 1 cách truy cập DB (Supabase REST hoặc SQLAlchemy) | A4 |
| 4 | Bổ sung `requirements.txt` + `.env` cho chạy được test | C1, C2 |
| 5 | Commit SQL của 3 RPC + migration các bảng mới | C3 |
| 6 | Sửa `CandidateMapper` + thêm cột thiếu vào `enrichment_profiles` | B1, B2 |
| 7 | Viết bước sinh embedding trong luồng upload | E |
| 8 | Dọn 4 file rỗng, giữ enum/MCP của admin-page rồi mới merge | D2–D6 |
| 9 | Sửa các lỗi nhỏ: prompt lệch schema, guard `max_steps`, `lexical_hits` | B3 + phụ |

---

## Cách tự kiểm chứng

```bash
git checkout ai-agent

# A1 — pipeline không import được
PYTHONPATH=".:src" venv/bin/python -c \
  "import src.backend.app.pipelines.resumeUploading_pipeline"

# A2 — provider không có generate_text
PYTHONPATH=".:src" venv/bin/python -c \
  "from src.backend.app.services.llm_provider import GroqProvider; \
   print([m for m in dir(GroqProvider) if not m.startswith('_')])"

# B1 — mapper duyệt chuỗi theo ký tự
PYTHONPATH=".:src" venv/bin/python -c "
from backend.app.mappers.candidate_mapper import CandidateMapper
class P: candidate_uuid='u1'; summary='s'; skills=[]; experience='3 years at ACME'
print(len(CandidateMapper.to_search_result_dto(P(), 0.9).experiences))
"

# C2 — test không chạy được
PYTHONPATH=".:src" venv/bin/python -m pytest tests -q
```
