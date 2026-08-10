# Báo cáo merge thử `ai-agent` → `feature/admin-page`

> **Ngày:** 2026-08-04
> **Nguồn:** `ai-agent` @ `4c3be11`
> **Đích:** `feature/admin-page` @ `2e22bb7` (đã merge `main` về, `main` là ancestor)
> **Merge base:** `eba77af`
> **Cách làm:** merge trong **git worktree tách riêng**, nhánh tạm `merge-check/ai-agent-into-admin`.
> `feature/admin-page` và `ai-agent` **không bị đụng vào**. Chưa push, chưa merge thật.

---

## 0. Kết luận trong 5 dòng

1. Merge **không sạch**: 18 file xung đột, và quan trọng hơn là **nhiều regression git tự động merge mà KHÔNG báo conflict**.
2. Sau merge, **FastAPI app chết hoàn toàn** — trước merge `apps/main.py` load được 12 route, sau merge `ImportError` ngay lúc import.
3. Merge **âm thầm xoá 4 file docs** vì git nhận nhầm rename.
4. Pipeline nghiệp vụ **đã đủ ~70% nhưng nằm hết ở `feature/admin-page`**, không phải ở `ai-agent`.
5. Hai nhánh **không nối được với nhau** vì viết vào hai bộ bảng khác nhau: mảnh ghép còn thiếu là `enrichment_profiles` + `embeddings` — không có bên nào sinh ra dữ liệu này trong luồng upload thật.

---

## 1. Kết quả merge

```
git merge ai-agent  →  Automatic merge failed
18 conflicted files
56 added / 11 add-add / 14 modified / 4 false-rename / 6 rename-delete / 1 content
```

### 1.1. Danh sách 18 file xung đột

| File | Loại | Bản chất xung đột |
|---|---|---|
| `app/database/connection.py` | add/add | **SQLAlchemy async engine** (admin-page) ⟷ **Supabase REST client** (ai-agent) |
| `app/database/init_db.sql` | modify/delete | ai-agent xoá file schema |
| `app/mcp/contracts/response.py` | rename/delete | ai-agent xoá tầng MCP |
| `app/mcp/dispatcher.py` | rename/delete | ai-agent xoá tầng MCP |
| `app/models/__init__.py` | add/add | 14 model (admin-page) ⟷ 9 model (ai-agent), khác gốc import |
| `app/models/enums.py` | add/add | **RoleType 3 giá trị ⟷ 6 giá trị** (xem 2.2) |
| `app/models/resume.py` | add/add | **2 schema khác nhau cho cùng bảng `resumes`** |
| `app/models/resume_analysis.py` | rename/delete | ai-agent xoá model |
| `app/models/resume_embedding.py` | add/add | `resume_embeddings` ⟷ `embeddings` (đổi tên bảng + đổi FK) |
| `app/models/user.py` | add/add | khác gốc import + khác enum role |
| `app/pipelines/resumeUploading_pipeline.py` | content | 2 phiên bản pipeline khác nhau |
| `app/repositories/resume_analysis_repository.py` | rename/delete | ai-agent xoá |
| `app/repositories/resume_embedding_repository.py` | rename/delete | ai-agent xoá |
| `app/repositories/resume_repository.py` | add/add | SQLAlchemy ⟷ Supabase REST |
| `app/repositories/user_repository.py` | add/add | SQLAlchemy ⟷ Supabase REST |
| `app/services/llm_provider.py` | add/add | **`generate_text()` + qwen3-32b ⟷ `invoke()` + llama-3.1-8b-instant** |
| `app/services/ranking_service.py` | add/add | `rank()` cosine ⟷ `fuse_and_rank()` hybrid |
| `requirements.txt` | add/add | 2 tập dependency khác nhau |

**Cách giải quyết trong lần merge thử này:** lấy bản `feature/admin-page` cho toàn bộ 18 file (vì đây là nhánh đang chạy được), riêng `requirements.txt` gộp cả hai. Đây là lựa chọn để *đo xem còn thiếu gì*, không phải phương án merge chính thức.

---

## 2. Regression git KHÔNG báo conflict — nguy hiểm nhất

### 2.1. App chết sau merge (đã đo)

| | `apps/main.py` | `backend/main.py` |
|---|---|---|
| **Trước merge** (`feature/admin-page`) | ✅ OK — 12 route | ✅ OK — 6 route |
| **Sau merge** | ❌ `ImportError` | ❌ `ImportError` |

```
ImportError: cannot import name 'Requirement' from partially initialized module
'backend.app.models.requirement' (most likely due to a circular import)
```

**Nguyên nhân:** git **tự động merge** (không hỏi) việc đổi gốc import trong 3 file model:

```diff
 src/backend/app/models/requirement.py
-from backend.app.models.base import Base
+from src.backend.app.models.base import Base

 src/backend/app/models/requirement_embedding.py
-from backend.app.models.base import Base
+from src.backend.app.models.base import Base

 src/backend/app/models/meeting.py
-from backend.app.models.base import Base
-from backend.app.models.enums import StatusType
+from src.backend.app.models.base import Base
+from src.backend.app.models.enums import StatusType
```

→ `Base` bị load thành **2 class khác nhau** (`backend.app.models.base.Base` và `src.backend.app.models.base.Base`) → 2 SQLAlchemy registry → circular import → toàn bộ backend không khởi động được.

Lỗi này **không xuất hiện trong danh sách conflict**. Nếu merge thật rồi push, người khác pull về sẽ thấy app chết mà không hiểu vì sao.

Cùng nguyên nhân, còn gặp:

```
InvalidRequestError: Table 'resume_embeddings' is already defined for this MetaData instance.
InvalidRequestError: Table 'requirement_embeddings' is already defined for this MetaData instance.
```

### 2.2. Regression role — undo công consolidate role

`feature/admin-page` đã chuẩn hoá còn **đúng 3 role** (`V005__consolidate_roles.sql`, `modules/shared/domain/roles.py`):

```python
ADMIN = "admin";  HR = "hr";  TECH_LEAD = "tech_lead"
```

`ai-agent` mang về **6 role**, thêm lại `recruiter`, `interviewer`, `candidate`. Nếu chọn nhầm bản ai-agent khi resolve → **phá vỡ ABAC + RBAC matrix** đã làm xong.

Tương tự `StatusType`:

| | admin-page | ai-agent |
|---|---|---|
| giá trị | `waiting` / `done` / `canceled` | `waiting` / `confirmed` / `cancelled` |

Hai bộ giá trị này ứng với **Postgres enum type**, sai là insert lỗi `22P02`.

### 2.3. Merge âm thầm xoá 4 file docs

`ai-agent` có 4 file `agents/tools/*.py` **rỗng 0 byte**. Git so khớp với 4 file docs bị xoá và kết luận đó là *rename*:

```
docs/analysis&design/mcp_architecture.md   → app/agents/tools/explanation.py
docs/management/deployment_guide.md        → app/agents/tools/github_search.py
docs/requirements/vision_agent_spec.md     → app/agents/tools/search_database.py
docs/test/agent_evaluation_report.md       → app/agents/tools/semantic_ranking.py
```

Kiểm tra sau merge: **cả 4 file đều MẤT**. Không có conflict nào được báo.

---

## 3. Sau merge — cái gì chạy, cái gì không

Smoke test import trên cây đã merge:

| Module | Kết quả |
|---|---|
| `modules.ingestion.application.ingestion_service` | ✅ OK |
| `modules.enrichment.application.enrichment_service` | ✅ OK |
| `modules.shared.infrastructure.config` | ✅ OK |
| `backend.app.services.llm_service` | ✅ OK |
| `backend.app.pipelines.resumeUploading_pipeline` | ✅ OK |
| `backend.app.agents.state` | ✅ OK |
| `backend.app.repositories.candidate_search_repository` | ✅ OK |
| `backend.app.mappers.candidate_mapper` | ✅ OK |
| `backend.app.agents.graph` | ❌ `No module named 'langgraph'` |
| `backend.app.services.candidate_search_service` | ❌ `cannot import name 'EnrichmentStatus'` |
| `backend.app.repositories.enrichment_repository` | ❌ `cannot import name 'EnrichmentStatus'` |
| `backend.app.models.candidate` | ❌ `cannot import name 'CandidateStatus'` |
| `backend.app.models.enrichment_profile` | ❌ `cannot import name 'EnrichmentStatus'` |
| `backend.app.repositories.embedding_repository` | ❌ `Table 'resume_embeddings' is already defined` |
| `backend.app.pipelines.candidateSearching_pipeline` | ❌ `Table 'requirement_embeddings' is already defined` |

Nghĩa là: **toàn bộ tầng ingestion/enrichment vẫn sống, toàn bộ tầng agent chết.**

---

## 4. Pipeline nghiệp vụ — hiện trạng thật sau khi gộp

> Pipeline mong muốn: candidate upload CV qua link job → đẩy lên Azure → parse → AI scoring / ranking / analyze → song song enrich GitHub + LinkedIn.

| # | Bước | Trạng thái | Ở nhánh nào | File |
|---|---|---|---|---|
| 1 | Upload CV theo link job (validate job PUBLISHED / chưa hết hạn) | ✅ **Đủ** | admin-page | `modules/ingestion/adapters/azure_routes.py` |
| 2 | Chặn file (magic bytes `%PDF`, giới hạn 10MB) | ✅ **Đủ** | admin-page | `azure_routes.py`, `app/api/ingestion.py` |
| 3 | Upload Azure Blob | ✅ **Đủ** | admin-page | `modules/ingestion/infra/azure_blob_service.py` |
| 4 | Bắn event qua Azure Service Bus | ✅ **Đủ** | admin-page | `modules/ingestion/infra/azure_service_bus_service.py` |
| 5 | Parse PDF + rút link GitHub/LinkedIn nhúng trong PDF | ✅ **Đủ** | admin-page | `modules/ingestion/application/ingestion_service.py` (pypdf + Gemini) |
| 6 | Enrich GitHub | ✅ **Đủ** | admin-page | `modules/enrichment/application/github_ingestion_service.py` |
| 7 | Enrich LinkedIn | ✅ **Đủ** | admin-page | `linkedin_ingestion_service.py`, `linkedin_scraper_service.py` |
| 8 | WebSocket đẩy tiến độ về UI | ✅ **Đủ** | admin-page | `modules/enrichment/adapters/routes.py`, `app/api/websocket.py` |
| 9 | Sinh embedding cho CV sau khi parse | ❌ **THIẾU** | — | không nhánh nào có trong luồng upload |
| 10 | Ghi `enrichment_profiles` + `embeddings` | ❌ **THIẾU** | — | ai-agent có repository nhưng **không ai gọi** |
| 11 | Scoring CV ⟷ job (Fit Score) | ❌ **THIẾU** | — | chỉ có comment "Fit Score" trong `V004__application_screening.sql` |
| 12 | Ranking ứng viên theo job | ⚠️ **Sai hướng** | ai-agent | `fuse_and_rank` phục vụ *recruiter query → tìm người*, không phải *CV vào → chấm điểm theo job* |
| 13 | Analyze CV bằng LLM (strengths/weaknesses) | ⚠️ **Có code, chưa chạy được** | ai-agent | `llm_service.analyze_resume` gọi `generate_text()` — bản ai-agent của provider **không có method này** |
| 14 | Agent hội thoại cho recruiter | ⚠️ **Có khung, chưa chạy** | ai-agent | thiếu `langgraph`, thiếu `GROQ_API_KEY` |

**Tỷ lệ: 8/14 đủ, 3/14 có nhưng chưa chạy được, 3/14 chưa có gì.**

---

## 5. Mắt xích còn thiếu quan trọng nhất: hai nửa không nối vào nhau

Bảng Supabase mỗi bên đọc/ghi:

| Nhánh | Bảng sử dụng |
|---|---|
| `feature/admin-page` (luồng upload) | `candidates`, `users`, `jobs_posting`, `github_profiles`, `linkedin_profiles` |
| `ai-agent` (luồng search) | `candidates`, `users`, `resumes`, **`enrichment_profiles`**, **`embeddings`** |

Giao nhau chỉ có `candidates` và `users`.

→ **Không có dòng code nào ghi vào `enrichment_profiles` và `embeddings` trong luồng upload thật.** Hai bảng này lại chính là nguồn dữ liệu duy nhất mà `CandidateSearchService` đọc. Kết quả: kể cả merge sạch, app chạy được, thì **agent search vẫn luôn trả về 0 ứng viên** với dữ liệu thật — chỉ chạy được với dữ liệu seed tay (`tests/seed_candidates.py`).

Đây là mảnh ghép quan trọng nhất còn thiếu, và **không nhánh nào đang làm**.

---

## 6. Danh sách việc còn thiếu (checklist)

### P0 — bắt buộc, nếu không thì không merge được

- [ ] **Thống nhất gốc import.** Chọn `backend.app.*` (chuẩn của admin-page, vì `apps/main.py` và toàn bộ `modules/` đang dùng) và sửa toàn bộ 86 chỗ `src.backend.app.*` bên ai-agent.
- [ ] **Thống nhất một cách truy cập DB.** Hiện có 3 kiểu song song: SQLAlchemy async (`app/database/connection.py`), Supabase REST (`app/repositories/base.py`), Supabase client riêng của modules (`modules/shared/infrastructure/supabase_client.py`).
- [ ] **Thống nhất `models/enums.py`.** Giữ `RoleType` 3 giá trị của admin-page, thêm `EnrichmentStatus`, `EmbeddingSource`, `CandidateStatus`, `ReviewDecision`, `AuditAction` từ ai-agent. Giữ `StatusType` của admin-page.
- [ ] **Quyết định schema bảng `resumes`.** admin-page: `(user_id, raw_text)`. ai-agent: `(candidate_uuid, filename, text_content)`. Phải chọn một.
- [ ] **Quyết định bảng embedding.** admin-page: `resume_embeddings` + `requirement_embeddings`. ai-agent: `embeddings` (gộp, FK sang `enrichment_profiles`).
- [ ] **Gộp `LLMProvider`.** Giữ cả `generate_text()` (pipeline cũ dùng) lẫn `invoke()` có structured output (agent dùng). Chọn 1 model, hiện đang mỗi bên một kiểu: `qwen/qwen3-32b` ⟷ `llama-3.1-8b-instant`.
- [ ] **Gộp `RankingService`.** Giữ cả `rank()` và `fuse_and_rank()`, hoặc bỏ hẳn cái cũ.
- [ ] **Khôi phục 4 file docs bị xoá do rename giả.** Xoá 4 file `agents/tools/*.py` rỗng trước khi merge để git không nhận nhầm.
- [ ] **Không xoá tầng MCP** (`app/mcp/*`) và `init_db.sql` mà ai-agent đang xoá.

### P1 — cần để pipeline chạy thông đầu-cuối

- [ ] **Viết bước sinh embedding trong luồng upload.** Sau khi Gemini parse xong → tạo `enrichment_profiles` → `EmbeddingService.embed_text()` → ghi `embeddings`. **Đây là mắt xích thiếu quan trọng nhất.**
- [ ] **Ghi kết quả GitHub/LinkedIn enrichment vào `enrichment_profiles`** (hiện đang ghi `github_profiles` / `linkedin_profiles` riêng, agent không đọc được).
- [ ] **Commit SQL của 3 RPC vào repo:** `search_similar_embeddings`, `search_profiles_lexically`, `get_candidate_ids_by_skills`. Hiện chỉ tồn tại trên Supabase cá nhân, `infrastructure/postgres/init.sql` rỗng.
- [ ] **Migration cho bảng mới:** `candidates`, `enrichment_profiles`, `embeddings` (+ extension `pgvector`). `src/backend/migrations/` mới có V002–V005, chưa có bảng nào của ai-agent.
- [ ] **Bổ sung dependency:** `langgraph`, `langgraph-checkpoint`, `transformers`, `huggingface-hub`, `accelerate` (từ ai-agent) và `groq`, `supabase` (cả hai nhánh đều thiếu khai báo trực tiếp).
- [ ] **Bổ sung env:** `GROQ_API_KEY` (chưa có trong `.env`), `SUPABASE_SERVICE_ROLE_KEY` (hiện chỉ có `SUPABASE_SERVICE_KEY` → 7/7 test bị skip).

### P2 — sửa lỗi logic đã phát hiện ở tầng agent

- [ ] `CandidateMapper._parse_experiences` duyệt chuỗi theo từng ký tự (`experience` là `Text` nhưng code `for exp in ...`) — đã verify: 1 chuỗi 15 ký tự → 15 `ExperienceDTO` rỗng.
- [ ] `enrichment_profiles` thiếu cột `strengths`, `weaknesses`, `github_summary`, `linkedin_summary` → gửi cho LLM luôn rỗng.
- [ ] `retrieval.py` đếm `lexical_hits` / `semantic_hits` bằng field không tồn tại → luôn = 0 → Reflection quyết định sai.
- [ ] `planner_prompt.md` yêu cầu status `"needed"` nhưng schema là `Literal["enough","not_enough"]`.
- [ ] `route_after_planner` không có guard `max_steps` → nguy cơ lặp vô hạn planner ↔ interaction.
- [ ] `resumeUploading_pipeline` (bản ai-agent): sai tên class import, sai chữ ký `create_resume`, `process_batch` không `await`.

### P3 — tính năng chưa có ai làm

- [ ] **Fit Score CV ⟷ job**: so khớp `applications` (salary, availability, experience_bucket, skill_ratings) với `jobs_posting`. Mới có comment trong migration, chưa có code.
- [ ] **Ranking ứng viên trong 1 job** (khác với recruiter search hiện tại).
- [ ] Module `ai-analytics` rỗng hoàn toàn.
- [ ] Gộp 2 entrypoint FastAPI: `src/backend/main.py` (6 route) và `src/backend/apps/main.py` (12 route) đang tồn tại song song.

---

## 7. Khuyến nghị

**Không merge trực tiếp `ai-agent` vào `feature/admin-page` ở trạng thái hiện tại.** Lý do: merge làm chết app mà không báo conflict, và undo công consolidate role.

Đề xuất thay vào đó:

1. Làm một nhánh `refactor/ai-agent-align` **xuất phát từ `feature/admin-page`**, rồi **cherry-pick / chép tay** phần thực sự mới của ai-agent vào (tầng `agents/`, `dtos/`, `mappers/`, `candidate_search_service`, `candidate_search_repository`, `ranking_service.fuse_and_rank`) — sửa gốc import và enum ngay khi chép.
2. Bỏ qua toàn bộ phần ai-agent viết lại chồng lên (models, connection, resume/user repository, pipeline cũ) — những phần này admin-page đã có bản chạy được.
3. Làm P1 mục "sinh embedding trong luồng upload" trước khi tính chuyện demo end-to-end, vì thiếu nó thì agent search không có dữ liệu.

---

## 8. Cách tái lập

```bash
git worktree add /tmp/merge-check -b merge-check/ai-agent-into-admin feature/admin-page
cd /tmp/merge-check
git merge ai-agent
git diff --name-only --diff-filter=U        # 18 file conflict

# xem regression git tự merge không báo:
git diff feature/admin-page HEAD -- src/backend/app/models/requirement.py

# xem 4 file docs bị mất:
comm -23 <(git ls-tree -r --name-only feature/admin-page | grep '\.md$' | sort) \
         <(git ls-tree -r --name-only HEAD | grep '\.md$' | sort)
```

Dọn dẹp sau khi xem xong:

```bash
git worktree remove /tmp/merge-check --force
git branch -D merge-check/ai-agent-into-admin
```
