"""Tìm kiếm ứng viên theo yêu cầu tuyển dụng bằng ngôn ngữ tự nhiên.

Lớp mỏng. Toàn bộ nghiệp vụ — lọc cứng theo kỹ năng, tìm từ khoá, tìm ngữ
nghĩa bằng pgvector, rồi hợp nhất điểm — đã nằm sẵn trong `CandidateSearchService`
của cây `app/` và đã có test. Ở đây chỉ làm ba việc mà lớp đó không làm:

1. dựng phụ thuộc từ `Settings` của ứng dụng;
2. nạp mô hình nhúng MỘT LẦN cho cả tiến trình;
3. che PII theo role trước khi trả ra ngoài.

Việc thứ ba là lý do luồng này bắt buộc phải đi qua đây chứ không phơi thẳng
service cũ ra HTTP: `app/` không biết gì về ABAC, nên gọi thẳng nó là mở một
cửa hậu vòng qua toàn bộ lớp che dữ liệu.
"""

import asyncio
import threading
from typing import List, Optional

import structlog

from modules.search.infra.legacy_bridge import (
    CandidateSearchRepository,
    CandidateSearchResultDTO,
    CandidateSearchService,
    EmbeddingService,
    EnrichmentRepository,
    HardFilterDTO,
    RankingService,
    SearchRequirementDTO,
    SoftRequirementDTO,
)
from modules.search.infra.scope import SupabaseSearchScope
from modules.shared.domain.job_visibility import visible_job_posting_ids
from modules.shared.infrastructure.abac import apply_abac

logger = structlog.get_logger(__name__)

#: Trần số ứng viên trả về một lượt. Có trần thì một client hỏng không kéo
#: được cả bảng về, và mỗi kết quả còn phải qua bước che PII.
MAX_TOP_K = 50

_model_lock = threading.Lock()
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Mô hình nhúng dùng chung, nạp lười và chỉ một lần.

    `SentenceTransformer` chiếm vài trăm MB và mất vài giây để nạp. Dựng mới
    theo từng request sẽ biến mỗi lượt tìm kiếm thành một lần nạp mô hình.
    """
    global _embedding_service
    if _embedding_service is None:
        with _model_lock:
            if _embedding_service is None:
                logger.info("search.embedding_model.loading")
                _embedding_service = EmbeddingService()
                logger.info("search.embedding_model.loaded")
    return _embedding_service


class SearchService:
    def __init__(self, client, embedding_service: EmbeddingService) -> None:
        self._inner = CandidateSearchService(
            search_repository=CandidateSearchRepository(client),
            enrichment_repository=EnrichmentRepository(client),
            embedding_service=embedding_service,
            ranking_service=RankingService(),
        )
        self._scope = SupabaseSearchScope(client)

    async def search(
        self,
        *,
        summary: str,
        experience: str = "",
        required_skills: Optional[List[str]] = None,
        top_k: int,
        min_score: float,
        user_id: str,
        role: str,
    ) -> List[dict]:
        requirement = SearchRequirementDTO(
            soft_query=SoftRequirementDTO(summary=summary, experience=experience),
            hard_filter=HardFilterDTO(skills=required_skills) if required_skills else None,
        )

        results: List[CandidateSearchResultDTO] = await self._inner.search(
            requirement=requirement, top_k=min(top_k, MAX_TOP_K)
        )

        # Ngưỡng lọc ở ĐÂY chứ không đẩy xuống repository: thanh trượt của HR
        # đổi liên tục, và lọc sau khi đã hợp nhất điểm cho phép đổi ngưỡng mà
        # không phải chạy lại truy vấn vector.
        kept = [r for r in results if r.score >= min_score]

        # Thu về phạm vi của người gọi: chỉ ứng viên đã nộp vào tin mà người
        # này được thấy (HR: tin mình tạo; tech lead: hội đồng). Tầng vector
        # xếp hạng trên toàn bộ ứng viên và không biết ai đang hỏi — không lọc
        # ở đây thì màn hình tìm kiếm là đường vòng qua mọi ranh giới dữ liệu.
        allowed_jobs = visible_job_posting_ids(role, user_id, self._scope)
        if allowed_jobs is not None:
            if not allowed_jobs:
                return []
            accessible = self._scope.candidates_on_job_postings(
                [r.candidate_id for r in kept], allowed_jobs
            )
            kept = [r for r in kept if r.candidate_id in accessible]

        # Che PII theo role. `app/` không biết gì về ABAC — bỏ bước này là mở
        # một đường vòng qua toàn bộ lớp che dữ liệu của hệ thống.
        return [apply_abac(self._to_payload(r), role) for r in kept]

    @staticmethod
    def _to_payload(result: CandidateSearchResultDTO) -> dict:
        """Đổi DTO sang hình dạng phản hồi.

        Đổi tên `candidate_id` thành `candidate_uuid` — đó là từ vựng mà
        `abac.py` biết, và whitelist so khớp theo TÊN field. Giữ nguyên tên cũ
        thì mã ứng viên bị che thành "***" và giao diện không mở nổi hồ sơ nào.
        """
        payload = result.model_dump()
        payload["candidate_uuid"] = payload.pop("candidate_id")
        return payload
