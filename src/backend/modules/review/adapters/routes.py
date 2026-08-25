from typing import Annotated, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from modules.auth.domain.models import AuthUser
from modules.review.application.review_service import ReviewService
from modules.review.domain.models import ReviewDecision, ReviewStatus
from modules.review.domain.repo_interface import IReviewRepo
from modules.review.infra.impl_supabase import SupabaseReviewRepo
from modules.shared.infrastructure.auth_dependencies import require_operational_roles
from modules.shared.infrastructure.config import Settings, get_settings
from modules.shared.infrastructure.supabase_client import get_supabase_client

router = APIRouter(prefix="/api/review", tags=["review"])

#: Dashboard xin tối đa ngần này ứng viên một lượt. Có trần thì một client
#: hỏng không kéo được cả bảng `cv_reviews` về trong một request.
MAX_BATCH = 100


def get_review_repo(settings: Settings = Depends(get_settings)) -> IReviewRepo:
    """Nguồn dữ liệu review. Tách riêng để test thay được bằng repo giả.

    Không có mối nối này thì test HTTP phải chạy trên Supabase thật, và mọi
    lần chạy sẽ ghi dữ liệu review vào cơ sở dữ liệu chung.
    """
    return SupabaseReviewRepo(get_supabase_client(settings, use_admin=True))


def _build_service(repo: IReviewRepo = Depends(get_review_repo)) -> ReviewService:
    return ReviewService(repo=repo)


ServiceDep = Annotated[ReviewService, Depends(_build_service)]


class SubmitReviewRequest(BaseModel):
    decision: ReviewDecision
    review_text: str = ""


class BatchStatusRequest(BaseModel):
    candidate_uuids: List[str] = Field(min_length=1, max_length=MAX_BATCH)


@router.post("/batch", response_model=Dict[str, ReviewStatus])
async def get_review_statuses(
    body: BatchStatusRequest,
    service: ServiceDep,
    _current_user: Annotated[AuthUser, Depends(require_operational_roles())],
) -> Dict[str, ReviewStatus]:
    """Trạng thái review của nhiều ứng viên trong một request.

    Khai báo TRƯỚC `/{candidate_uuid}`: đăng ký sau thì "batch" sẽ bị route
    tham số nuốt mất và biến thành một candidate_uuid.
    """
    return await service.get_statuses(body.candidate_uuids)


@router.post("/{candidate_uuid}", response_model=ReviewStatus)
async def submit_review(
    candidate_uuid: str,
    body: SubmitReviewRequest,
    service: ServiceDep,
    current_user: Annotated[AuthUser, Depends(require_operational_roles())],
) -> ReviewStatus:
    if body.decision not in ("approved", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="decision must be 'approved' or 'rejected'",
        )
    try:
        return await service.submit_review(
            candidate_uuid=candidate_uuid,
            reviewer_id=current_user.id,
            reviewer_role=current_user.role,
            decision=body.decision,
            review_text=body.review_text,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{candidate_uuid}", response_model=ReviewStatus)
async def get_review_status(
    candidate_uuid: str,
    service: ServiceDep,
    _current_user: Annotated[AuthUser, Depends(require_operational_roles())],
) -> ReviewStatus:
    return await service.get_status(candidate_uuid)
