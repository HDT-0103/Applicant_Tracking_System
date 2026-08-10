# Bàn giao dữ liệu cho AI agent scoring/ranking

**Phạm vi đã làm (branch `feature/admin-page`):** đảm bảo input cho scoring — cặp ID trong `applications`, file CV trên Azure tải được, và embedding cho job posting. **Scoring/ranking và các bảng điểm (`application_scores`...) do người làm agent tự thiết kế** — tài liệu này mô tả những gì đã có sẵn để dùng.

## 1. Input: lấy các resume đã apply vào một job

`public.applications` là bảng nối, mỗi đơn ứng tuyển 1 dòng:

| Cột | Ý nghĩa |
|---|---|
| `id` | application_id — nên dùng làm khoá cho điểm số (1 người apply nhiều job = nhiều đơn = nhiều điểm) |
| `job_posting_id` | FK → `jobs_posting.id` |
| `resume_id` | FK → `resumes.id` |
| `candidate_uuid` | FK → `candidates.uuid` |
| `status`, `submitted_at` + các cột screening (V004) | work_authorization, expected_salary_min/max, skill_ratings, consent_data_sharing... |

Query mẫu (SQL):

```sql
SELECT a.id AS application_id, a.candidate_uuid, r.id AS resume_id,
       r.filename, r.file_path, c.full_name, c.email
FROM applications a
JOIN resumes r ON r.id = a.resume_id
JOIN candidates c ON c.uuid = a.candidate_uuid
WHERE a.job_posting_id = '<JOB_UUID>';
```

Qua supabase-py / PostgREST:

```
applications?select=id,candidate_uuid,resume_id,submitted_at,status,resumes(id,filename,file_path),candidates(uuid,full_name,email)&job_posting_id=eq.<JOB_UUID>
```

Lưu ý:
- Chỉ luồng **careers frontend** tạo `applications` (upload từ HR dashboard không kèm job → chỉ có `candidates` + blob, không có đơn).
- `resumes.text_content` hiện **NULL** — text CV chưa được persist (chỉ tồn tại trong RAM lúc ingest). Agent cần tự parse PDF từ `file_path`, hoặc yêu cầu team thêm feature persist text.

## 2. File CV trên Azure

- Container `candidate-cvs`, blob `{candidate_uuid}.pdf`; URL lưu ở `resumes.file_path` (và `candidates.cv_file_path`).
- Tải qua backend (đã fix SAS): `GET /api/v1/candidates/{candidate_uuid}/cv` → redirect tới SAS URL sống 1 giờ.

## 3. Embedding của job posting — `public.job_embeddings` (V006)

Mỗi job có tối đa 2 vector:

| `source_type` | Nội dung |
|---|---|
| `summary` | job_title + department + description |
| `requirements` | requirements + key_responsibilities |

**Skills KHÔNG embed** (chốt với scoring-side): giữ nguyên dạng `text[]` trên `jobs_posting.must_have_skills` / `nice_to_have_skills` để hard-filter chính xác — ví dụ:

```sql
-- job đòi Python trong must-have
SELECT id FROM jobs_posting WHERE must_have_skills @> ARRAY['python'];
-- hoặc tính coverage giữa 2 mảng skill (job vs candidate) bằng Jaccard/overlap
```

Phía candidate cũng vậy: so skill bằng mảng (`enrichment_profiles.skills text[]`), không so cosine trên skill.

Cột: `job_posting_id`, `source_type`, `text_content` (text gốc đã embed), `embedding vector(768)`, `model_name`, `created_at`. Unique theo `(job_posting_id, source_type, model_name)`. Index HNSW cosine đã tạo.

### ⚠️ Convention embedding — phía candidate PHẢI theo đúng

- **Model:** `intfloat/multilingual-e5-base`, 768 chiều, normalize.
- **Prefix E5:** JD đã embed với `query:`. Resume/candidate profile phải embed **cùng model** với prefix `passage:`. Sai/thiếu prefix hoặc khác model → cosine vô nghĩa.
- Code dùng chung: `modules/scoring/application/embedding_service.py` — gọi `get_embedding_provider(settings).embed(texts, kind="passage")` là có đúng model + prefix; đừng tự khởi tạo SentenceTransformer riêng.

### Tạo / refresh embedding

- Tự động idempotent: `POST /api/v1/jobs/{job_id}/embeddings` (cần token role `hr`; body `{"force": true}` để ép re-embed sau khi sửa JD).
- Backfill hàng loạt: `./venv/bin/python src/backend/scripts/backfill_job_embeddings.py` (mặc định mọi job PUBLISHED; `--all`, `--force`).
- Job sửa sau khi embed (`jobs_posting.updated_at` mới hơn) sẽ tự được embed lại ở lần gọi ensure tiếp theo.
- Verify schema: `./venv/bin/python src/backend/scripts/check_job_embeddings_schema.py`.

### So khớp mẫu (candidate vector × job vector)

```sql
SELECT je.job_posting_id, je.source_type,
       1 - (je.embedding <=> '<candidate_passage_vector>') AS cosine_sim
FROM job_embeddings je
WHERE je.model_name = 'intfloat/multilingual-e5-base'
ORDER BY je.embedding <=> '<candidate_passage_vector>'
LIMIT 10;
```

## 4. Những gì scoring-side cần tự làm (ngoài scope bàn giao)

- Bảng điểm (`application_scores`... — khoá theo `application_id` là hợp lý nhất), logic hard gate / soft score / ranking.
- Embedding phía candidate (dùng chung `embedding_service.py`, prefix `passage:`).
- Persist `resumes.text_content` nếu không muốn parse lại PDF mỗi lần.
