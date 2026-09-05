"""Chạy pipeline xử lý CV của cây `app/` sau khi hồ sơ được nộp.

## Vì sao file này tồn tại

`CVProcessingPipeline` (bóc tách CV bằng LLM → lưu tóm tắt/kỹ năng → nhúng
vector → chấm điểm khớp với tin) có mặt trên `main` từ lâu nhưng không có
route hay task nào gọi nó. Hệ quả trên DB thật: bảng `embeddings` chỉ có vài
dòng do ai đó chạy tay, `applications.overall_score` NULL ở mọi đơn, và cả
tìm kiếm ngữ nghĩa lẫn xếp hạng không có dữ liệu để chạy.

File này là mắt xích còn thiếu: route upload gọi `post_ingest_worker` trong
BackgroundTasks; worker chạy pipeline TRƯỚC rồi mới tới `enrichment_worker`
(GitHub/LinkedIn). Tuần tự chứ không song song, vì cả hai cùng ghi một hàng
`enrichment_profiles`.

## Những thứ pipeline cần mà luồng thật không sẵn có

* **Text CV**: file tạm đã bị xoá ngay trong request. Lấy `resume_text` từ
  candidate store trong bộ nhớ (do `process_cv_resume` ghi) và đưa thẳng vào
  `process_cv(resume_text=...)`.
* **Vector của tin**: `job_embeddings` có thể rỗng nếu tin được tạo trước khi
  catalog nối `ensure_job_embeddings`. Tự lấp trước khi chấm.
* **Mô hình nhúng**: cây `app/` có `EmbeddingService` riêng, nạp thêm một bản
  e5-base ~1 GB và KHÔNG chuẩn hoá vector. Ở đây bọc `LocalE5Provider` (một
  singleton cho cả tiến trình, có chuẩn hoá) thành object có
  `generate_embedding` mà pipeline mong đợi.
"""
from __future__ import annotations

from typing import Optional

import structlog

from modules.ingestion.domain.candidate_repository import get_candidate
from modules.scoring.application.embedding_service import LocalE5Provider
from modules.scoring.application.job_embedding_service import ensure_job_embeddings
from modules.shared.infrastructure.config import Settings
from modules.shared.infrastructure.supabase_client import get_supabase_client

logger = structlog.get_logger(__name__)


class E5PassageEmbedder:
    """Adapter: `generate_embedding(text)` của pipeline → `LocalE5Provider`.

    Văn bản của ứng viên là *passage* (tin tuyển dụng được nhúng dưới dạng
    *query* trong `job_embedding_service`); E5 cần đúng tiền tố đó ở cả hai
    phía thì cosine mới có nghĩa.
    """

    def __init__(self) -> None:
        self._provider = LocalE5Provider()

    async def generate_embedding(self, text: str) -> list[float]:
        vectors = await self._provider.embed([text], kind="passage")
        return vectors[0]


def build_cv_pipeline(client):
    """Dựng pipeline với repo thật. Tách riêng để test thay được từng phần."""
    from modules.search.infra.legacy_bridge import (
        ApplicationRepository,
        CVProcessingPipeline,
        EmbeddingRepository,
        EnrichmentRepository,
        JobEmbeddingRepository,
        JobPostingRepository,
        LLMService,
        build_default_llm_provider,
    )

    return CVProcessingPipeline(
        enrichment_repo=EnrichmentRepository(client),
        embedding_repo=EmbeddingRepository(client),
        application_repo=ApplicationRepository(client),
        job_posting_repo=JobPostingRepository(client),
        job_embedding_repo=JobEmbeddingRepository(client),
        llm_service=LLMService(build_default_llm_provider()),
        embedding_service=E5PassageEmbedder(),
    )


async def run_cv_pipeline(
    candidate_uuid: str,
    application_id: Optional[str],
    job_id: Optional[str],
    settings: Settings,
) -> bool:
    """Chạy pipeline cho một hồ sơ vừa nộp. Trả True nếu chấm xong.

    Mọi lỗi được ghi log và nuốt ở đây: đây là task nền, không còn ai để trả
    lỗi về, và hồ sơ đã được lưu chắc từ trong request. Nhưng KHÔNG ghi gì
    giả: không có text thì không có điểm, và cột điểm để NULL.
    """
    candidate = get_candidate(candidate_uuid)
    resume_text = (candidate.resume_text or "").strip() if candidate else ""
    if not resume_text:
        logger.warning(
            "cv_pipeline.skipped.no_text",
            candidate_uuid=candidate_uuid,
            reason="PDF không có text (scan ảnh?) hoặc hồ sơ không còn trong bộ nhớ",
        )
        return False

    client = get_supabase_client(settings, use_admin=True)
    if client is None:
        logger.error("cv_pipeline.skipped.no_supabase", candidate_uuid=candidate_uuid)
        return False

    if job_id:
        # Tin tạo trước khi catalog nối bước nhúng thì chưa có vector. Không
        # lấp thì mọi hồ sơ nộp vào tin đó nhận overall_score NULL mãi.
        try:
            await ensure_job_embeddings(job_id, settings)
        except Exception as exc:
            logger.warning(
                "cv_pipeline.job_embeddings_failed",
                job_id=job_id,
                error=str(exc)[:200],
            )

    try:
        pipeline = build_cv_pipeline(client)
    except Exception as exc:
        # Thiếu key LLM là lỗi cấu hình, không phải lỗi của hồ sơ này.
        logger.error("cv_pipeline.not_configured", candidate_uuid=candidate_uuid, error=str(exc)[:200])
        return False

    try:
        result = await pipeline.process_cv(
            candidate_uuid=candidate_uuid,
            job_posting_id=job_id,
            application_id=application_id if job_id else None,
            resume_text=resume_text,
        )
    except Exception as exc:
        logger.error(
            "cv_pipeline.failed",
            candidate_uuid=candidate_uuid,
            error_type=type(exc).__name__,
            error=str(exc)[:300],
        )
        return False

    logger.info(
        "cv_pipeline.done",
        candidate_uuid=candidate_uuid,
        application_id=application_id,
        overall_score=getattr(result, "overall_score", None),
    )
    return True


async def refresh_job_embeddings(job_id: str, settings: Settings) -> None:
    """Nhúng tin sau khi lưu/đăng, chạy nền. Lỗi chỉ ghi log.

    `ensure_job_embeddings` tự bỏ qua khi vector còn mới, nên gọi ở mọi lần
    lưu là an toàn; cái giá duy nhất là lần đầu nạp mô hình (~7 giây) trong
    background.
    """
    try:
        result = await ensure_job_embeddings(job_id, settings)
        logger.info(
            "job_embeddings.refreshed",
            job_id=job_id,
            skipped=result.skipped,
            embedded=result.embedded,
        )
    except Exception as exc:
        logger.error("job_embeddings.refresh_failed", job_id=job_id, error=str(exc)[:200])
