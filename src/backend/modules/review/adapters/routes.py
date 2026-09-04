from typing import Annotated, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from modules.auth.domain.models import AuthUser
from modules.review.application.review_service import ReviewService
from modules.review.domain.models import PanelMember, ReviewDecision, ReviewStatus
from modules.review.domain.repo_interface import IReviewRepo
from modules.review.infra.impl_supabase import SupabaseReviewRepo
from modules.shared.infrastructure.auth_dependencies import (
    require_operational_roles,
    require_roles,
)
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


class InviteReviewerRequest(BaseModel):
    reviewer_id: str


class BatchStatusRequest(BaseModel):
    candidate_uuids: List[str] = Field(min_length=1, max_length=MAX_BATCH)


@router.get("/reviewers", response_model=List[PanelMember])
async def list_available_reviewers(
    service: ServiceDep,
    _current_user: Annotated[AuthUser, Depends(require_roles("hr"))],
) -> List[PanelMember]:
    """Tech Lead mà HR có thể mời. Khai TRƯỚC /panels/{id} để không bị nuốt."""
    return await service.list_available_reviewers()


# 404 chứ không 403 cho tin ngoài phạm vi: 403 xác nhận tin đó tồn tại.
_JOB_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="Job posting not found."
)


async def _require_job_access(service: ReviewService, job_posting_id: str, user: AuthUser) -> None:
    if not await service.may_access_job_posting(job_posting_id, user.id, user.role):
        raise _JOB_NOT_FOUND


@router.get("/panels/{job_posting_id}", response_model=List[PanelMember])
async def get_panel(
    job_posting_id: str,
    service: ServiceDep,
    current_user: Annotated[AuthUser, Depends(require_operational_roles())],
) -> List[PanelMember]:
    """Hội đồng Tech Lead của một tin tuyển dụng — của tin mình được thấy."""
    await _require_job_access(service, job_posting_id, current_user)
    return await service.get_panel(job_posting_id)


@router.post("/panels/{job_posting_id}", response_model=List[PanelMember])
async def invite_reviewer(
    job_posting_id: str,
    body: InviteReviewerRequest,
    service: ServiceDep,
    current_user: Annotated[AuthUser, Depends(require_roles("hr"))],
) -> List[PanelMember]:
    """Mời một Tech Lead vào hội đồng. Chỉ HR TẠO TIN mời được.

    Quyết định ai chấm hồ sơ là quyết định nhân sự; để tech lead tự thêm mình
    vào thì họ tự cấp quyền xem PII cho chính mình. Và một HR lập hội đồng
    cho tin của HR khác là tự cấp cho tech lead của mình quyền đọc hồ sơ của
    người khác.
    """
    await _require_job_access(service, job_posting_id, current_user)
    return await service.invite_reviewer(
        job_posting_id=job_posting_id,
        reviewer_id=body.reviewer_id,
        invited_by=current_user.id,
    )


@router.delete("/panels/{job_posting_id}/{reviewer_id}", response_model=List[PanelMember])
async def remove_reviewer(
    job_posting_id: str,
    reviewer_id: str,
    service: ServiceDep,
    current_user: Annotated[AuthUser, Depends(require_roles("hr"))],
) -> List[PanelMember]:
    await _require_job_access(service, job_posting_id, current_user)
    return await service.remove_reviewer(job_posting_id, reviewer_id)


@router.post("/batch", response_model=Dict[str, ReviewStatus])
async def get_review_statuses(
    body: BatchStatusRequest,
    service: ServiceDep,
    current_user: Annotated[AuthUser, Depends(require_operational_roles())],
) -> Dict[str, ReviewStatus]:
    """Trạng thái review của nhiều ứng viên trong một request.

    Khai báo TRƯỚC `/{candidate_uuid}`: đăng ký sau thì "batch" sẽ bị route
    tham số nuốt mất và biến thành một candidate_uuid.
    """
    return await service.get_statuses(
        body.candidate_uuids, user_id=current_user.id, role=current_user.role
    )


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
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{candidate_uuid}", response_model=ReviewStatus)
async def get_review_status(
    candidate_uuid: str,
    service: ServiceDep,
    current_user: Annotated[AuthUser, Depends(require_operational_roles())],
) -> ReviewStatus:
    # 404 chứ không 403: 403 xác nhận ứng viên đó tồn tại, biến endpoint thành
    # công cụ dò xem một người có ứng tuyển hay không.
    if not await service.may_access_candidate(
        candidate_uuid, current_user.id, current_user.role
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found."
        )
    return await service.get_status(candidate_uuid)
