> **Cập nhật 2026-09-05.** Pipeline này đã được **nối vào luồng upload**:
> `modules/scoring/application/cv_pipeline.py` chạy nó trong task nền sau
> `POST /api/v1/ingest` (trước `enrichment_worker`). `CandidateRankingService`
> ở phần 2 **đã xoá**; bảng xếp hạng đọc qua
> `GET /api/catalog/job-postings/{id}/ranking` (catalog, có phạm vi người
> dùng + ABAC). Khác với sơ đồ dưới: `process_cv` nhận `resume_text` thay vì
> file, `job_posting_id` là tuỳ chọn, cosine so theo ĐÚNG cặp (summary↔summary,
> experience↔requirements), và `overall_score` tính bằng `ScoreAggregator`
> (summary 0.3 / experience 0.5 / github 0.2, tái phân bổ khi thiếu tín hiệu).
> Xem CLAUDE.md mục "Pipeline CV và enrichment cùng ghi một hàng".

# 📝 BÁO CÁO KỸ THUẬT: REFACTOR CV PROCESSING PIPELINE & CANDIDATE RANKING SERVICE

## 1. Tổng quan các thay đổi (Refactoring Summary)

Để tuân thủ triệt để kiến trúc Clean Architecture / Repository Pattern, toàn bộ logic truy vấn dữ liệu đã được tách khỏi các Pipeline & Service layer. Các Pipeline giờ đây chỉ đóng vai trò Orchestrator (Bộ điều phối).

### 🔑 Các điểm nâng cấp chính:

**ApplicationRepository (Mở rộng):**

Thêm hàm `get_ranked_applications(job_posting_id, limit, offset)` hỗ trợ query danh sách ứng viên đã xếp hạng bằng overall_score DESC trực tiếp từ DB.

**CVProcessingPipeline (Tái thiết kế):**

Loại bỏ hoàn toàn các lời gọi trực tiếp tới Supabase client.

Giao tiếp $100%$ thông qua 5 Repositories: EnrichmentRepository, EmbeddingRepository, ApplicationRepository, JobPostingRepository, JobEmbeddingRepository.

Luồng tự động: Parse CV $\rightarrow$ LLM Analysis $\rightarrow$ Save Profile $\rightarrow$ Generate Multi-Embeddings (Summary/Experience) $\rightarrow$ Calculate Cosine Similarity $\rightarrow$ Update Application Scores.

**CandidateRankingService (Tối ưu Latency):**

Sử dụng cơ chế Pre-calculated Score (Option 1). Query danh sách ứng viên đã nộp theo job_posting_id đạt tốc độ $O(1)$ realtime.

**Chuẩn hóa Namespace Imports:**

Sửa toàn bộ đường dẫn import chưa đồng bộ backend.app... thành src.backend.app....

## 2. Sơ đồ Luồng Dữ liệu (Data Flow Diagram)

```text
 [Candidate Upload CV]
           │
           ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                        CVProcessingPipeline                            │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 1. ParserService        ──> Parse PDF/Word to Clean Text              │
 │ 2. LLMService           ──> Extract Structured Resume Analysis        │
 │ 3. EnrichmentRepo       ──> Create / Update Enrichment Profile        │
 │ 4. EmbeddingService     ──> Vectorize Summary & Experience            │
 │ 5. EmbeddingRepo        ──> Save Vectors to `embeddings` Table        │
 │ 6. JobPosting/Emb Repos ──> Retrieve Job Requirements Embeddings       │
 │ 7. ApplicationRepo      ──> Save Calculated Matching Scores           │
 └────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼ (Saved Scores in DB)
 ┌────────────────────────────────────────────────────────────────────────┐
 │                     HR Candidate Ranking View                          │
 ├────────────────────────────────────────────────────────────────────────┤
 │ CandidateRankingService ──> ApplicationRepo.get_ranked_applications()  │
 │                         ──> ORDER BY overall_score DESC                │
 └────────────────────────────────────────────────────────────────────────┘
```

## 3. Trạng thái Kiểm thử (Test Status)

**File Test:** `tests/pipelines/test_cv_processing_pipeline.py`

**Kết quả:** PASSED (Mọi mock Repository và Service tương tác chính xác theo đúng Contract).
