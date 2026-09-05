from typing import Annotated, List, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from modules.auth.domain.models import AuthUser
from modules.search.application.search_service import (
    MAX_TOP_K,
    SearchService,
    get_embedding_service,
)
from src.backend.app.dtos.find_candidate import FindCandidateRequest, FindCandidateResult
from src.backend.app.repositories.candidate_search_repository import CandidateSearchRepository
from src.backend.app.services.find_candidate_service import FindCandidateService
from modules.search.infra.scope import SupabaseSearchScope
from modules.shared.domain.job_visibility import visible_job_posting_ids
from modules.shared.infrastructure.auth_dependencies import require_operational_roles
from modules.shared.infrastructure.abac import apply_abac
from modules.shared.infrastructure.config import Settings, get_settings
from modules.shared.infrastructure.supabase_client import get_supabase_client

router = APIRouter(prefix="/api/search", tags=["search"])
logger = structlog.get_logger(__name__)


def get_search_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> SearchService:
    client = get_supabase_client(settings, use_admin=True)
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Candidate search is unavailable: the database is not configured.",
        )
    return SearchService(client=client, embedding_service=get_embedding_service())


def get_find_candidate_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> FindCandidateService:
    client = get_supabase_client(settings, use_admin=True)
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Candidate search is unavailable: the database is not configured.",
        )
    repository = CandidateSearchRepository(client)
    return FindCandidateService(
        search_repository=repository,
        candidate_repository=repository,
        embedding_service=get_embedding_service(),
    )


def get_search_scope(
    settings: Annotated[Settings, Depends(get_settings)],
) -> SupabaseSearchScope:
    """Phạm vi dữ liệu của người gọi (tin mình tạo / hội đồng mình ở trong).

    Tách thành dependency để test thay bằng scope giả — cùng cách
    `test_search_routes.py` làm với `/api/search`.
    """
    client = get_supabase_client(settings, use_admin=True)
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Candidate search is unavailable: the database is not configured.",
        )
    return SupabaseSearchScope(client)


ServiceDep = Annotated[SearchService, Depends(get_search_service)]
FindCandidateServiceDep = Annotated[
    FindCandidateService, Depends(get_find_candidate_service)
]
ScopeDep = Annotated[SupabaseSearchScope, Depends(get_search_scope)]


class SearchRequest(BaseModel):
    """Yêu cầu tuyển dụng viết bằng ngôn ngữ tự nhiên."""

    #: Mô tả vị trí. Đây là phần đi vào tìm kiếm ngữ nghĩa.
    summary: str = Field(min_length=1, max_length=4000)
    #: Yêu cầu kinh nghiệm, cho vào một vector riêng và có trọng số riêng.
    experience: str = Field(default="", max_length=4000)
    #: Kỹ năng BẮT BUỘC. Đây là bộ lọc cứng chạy TRƯỚC: thiếu là loại, bất kể
    #: điểm ngữ nghĩa cao đến đâu.
    required_skills: Optional[List[str]] = Field(default=None, max_length=25)
    top_k: int = Field(default=10, ge=1, le=MAX_TOP_K)
    #: Ngưỡng của thanh trượt bên giao diện. Đổi ngưỡng KHÔNG chạy lại truy vấn
    #: vector — điểm đã có, chỉ lọc lại.
    min_score: float = Field(default=0.0, ge=0.0, le=1.0)


class SearchResponse(BaseModel):
    results: List[dict]
    total: int
    #: Nhắc lại ngưỡng đã áp dụng, để giao diện không phải tự đoán kết quả ứng
    #: với lần kéo thanh trượt nào.
    min_score: float


@router.post("", response_model=SearchResponse)
async def search_candidates(
    body: SearchRequest,
    service: ServiceDep,
    user: Annotated[AuthUser, Depends(require_operational_roles())],
) -> SearchResponse:
    """Xếp hạng ứng viên theo mức phù hợp ngữ nghĩa với yêu cầu tuyển dụng.

    Kết quả đã được che PII theo role của người gọi, cùng luật với mọi màn hình
    khác — `tech_lead` nhận hồ sơ không có danh tính.
    """
    results = await service.search(
        summary=body.summary,
        experience=body.experience,
        required_skills=body.required_skills,
        top_k=body.top_k,
        min_score=body.min_score,
        user_id=user.id,
        role=user.role,
    )
    logger.info(
        "search.completed",
        user_id=user.id,
        role=user.role,
        returned=len(results),
        min_score=body.min_score,
    )
    return SearchResponse(
        results=results, total=len(results), min_score=body.min_score
    )


@router.post("/find", response_model=list[FindCandidateResult])
async def find_candidates(
    body: FindCandidateRequest,
    service: FindCandidateServiceDep,
    scope: ScopeDep,
    user: Annotated[AuthUser, Depends(require_operational_roles())],
) -> list[FindCandidateResult]:
    """Tìm kiếm lai (từ khoá + vector), ad-hoc, không tạo hay sửa application.

    Cùng hai luật với `/api/search`: (1) chỉ ứng viên đã nộp vào tin người gọi
    được thấy — bản đầu của endpoint này quét cả bảng `candidates` và trả tên,
    email, số điện thoại của mọi ứng viên cho bất kỳ HR nào; (2) che PII theo
    role trước khi trả.
    """
    allowed_jobs = visible_job_posting_ids(user.role, user.id, scope)
    scope_ids: Optional[List[str]] = None
    if allowed_jobs is not None:
        if not allowed_jobs:
            return []
        scope_ids = scope.candidates_for_job_postings(allowed_jobs)
        if not scope_ids:
            return []

    results = await service.find(body, scope_candidate_ids=scope_ids)
    logger.info(
        "search.find.completed",
        user_id=user.id,
        role=user.role,
        returned=len(results),
        scoped=scope_ids is not None,
    )
    return [
        FindCandidateResult.model_validate(apply_abac(result.model_dump(), user.role))
        for result in results
    ]
