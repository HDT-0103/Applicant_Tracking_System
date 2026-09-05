from typing import Annotated, List, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel

from modules.auth.domain.models import AuthUser
from modules.catalog.application.catalog_service import CatalogService
from modules.catalog.domain.models import (
    RankedCandidate,
    AnalyticsData,
    CandidateOption,
    DashboardData,
    JobPostingDraft,
    JobPostingSummary,
)
from modules.catalog.infra.impl_supabase import SupabaseCatalogRepo
from modules.scoring.application.cv_pipeline import refresh_job_embeddings
from modules.shared.infrastructure.auth_dependencies import (
    require_operational_roles,
    require_roles,
)
from modules.shared.infrastructure.config import Settings, get_settings
from modules.shared.infrastructure.supabase_client import get_supabase_client

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


def get_catalog_repo(settings: Annotated[Settings, Depends(get_settings)]):
    """Tách ra để test thay được bằng repo giả, không phải chạm Supabase thật."""
    return SupabaseCatalogRepo(get_supabase_client(settings, use_admin=True))


def _build_service(repo=Depends(get_catalog_repo)) -> CatalogService:
    return CatalogService(repo=repo)


ServiceDep = Annotated[CatalogService, Depends(_build_service)]


def get_job_embedding_hook():
    """Việc nền sau khi lưu tin: nhúng vector cho tìm kiếm/chấm điểm.

    Là dependency để test thay bằng hàm rỗng — nếu không, mỗi test lưu tin
    sẽ nạp mô hình 1 GB và gọi Supabase thật ngay sau response.
    """
    return refresh_job_embeddings


HookDep = Annotated[object, Depends(get_job_embedding_hook)]

# 404 chứ không 403 cho tin ngoài phạm vi: 403 xác nhận tin đó tồn tại, và một
# HR có thể dò id của người khác bằng cách đọc mã trạng thái.
_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="Job posting not found."
)


@router.get("/dashboard", response_model=DashboardData)
async def get_dashboard(
    service: ServiceDep,
    user: Annotated[AuthUser, Depends(require_operational_roles())],
) -> DashboardData:
    """Ứng viên gần đây + lịch đã đặt, đã lọc theo phạm vi và đã che PII."""
    return service.get_dashboard(user_id=user.id, role=user.role)


@router.get("/candidates/options", response_model=List[CandidateOption])
async def list_candidate_options(
    service: ServiceDep,
    user: Annotated[AuthUser, Depends(require_operational_roles())],
) -> List[CandidateOption]:
    """Danh sách chọn ứng viên cho màn hình đặt lịch."""
    return service.list_candidate_options(user_id=user.id, role=user.role)


@router.get("/job-postings", response_model=List[JobPostingSummary])
async def list_job_postings(
    service: ServiceDep,
    user: Annotated[AuthUser, Depends(require_operational_roles())],
) -> List[JobPostingSummary]:
    """Tin của người gọi: HR thấy tin mình tạo, tech lead thấy tin mình chấm."""
    return service.list_job_postings(user_id=user.id, role=user.role)


@router.get("/job-postings/{job_posting_id}", response_model=dict)
async def get_job_posting(
    job_posting_id: str,
    service: ServiceDep,
    user: Annotated[AuthUser, Depends(require_operational_roles())],
) -> dict:
    """Chi tiết một tin. Tech lead trong hội đồng cũng đọc được — trang chi
    tiết tin là chung cho cả hai role; phần ghi vẫn chỉ dành cho HR."""
    try:
        return service.get_job_posting(job_posting_id, user_id=user.id, role=user.role)
    except LookupError:
        raise _NOT_FOUND


@router.post("/job-postings", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_job_posting(
    body: JobPostingDraft,
    service: ServiceDep,
    user: Annotated[AuthUser, Depends(require_roles("hr"))],
    background_tasks: BackgroundTasks,
    settings: Annotated[Settings, Depends(get_settings)],
    hook: HookDep,
) -> dict:
    row = service.save_job_posting(
        body, job_posting_id=None, user_id=user.id, role=user.role
    )
    _schedule_embedding(background_tasks, hook, row.get("id"), settings)
    return row


@router.put("/job-postings/{job_posting_id}", response_model=dict)
async def update_job_posting(
    job_posting_id: str,
    body: JobPostingDraft,
    service: ServiceDep,
    user: Annotated[AuthUser, Depends(require_roles("hr"))],
    background_tasks: BackgroundTasks,
    settings: Annotated[Settings, Depends(get_settings)],
    hook: HookDep,
) -> dict:
    try:
        row = service.save_job_posting(
            body, job_posting_id=job_posting_id, user_id=user.id, role=user.role
        )
    except LookupError:
        raise _NOT_FOUND
    # Sửa JD là đổi thứ mà CV được so khớp; vector cũ trở thành sai.
    _schedule_embedding(background_tasks, hook, job_posting_id, settings)
    return row


@router.delete("/job-postings/{job_posting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job_posting(
    job_posting_id: str,
    service: ServiceDep,
    user: Annotated[AuthUser, Depends(require_roles("hr"))],
) -> None:
    """Xoá tin tuyển dụng. Chỉ HR — tech lead chấm hồ sơ, không quản tin."""
    try:
        service.delete_job_posting(job_posting_id, user_id=user.id, role=user.role)
    except LookupError:
        raise _NOT_FOUND


class SetStatusRequest(BaseModel):
    status: Literal["DRAFT", "PUBLISHED", "CLOSED"]


@router.patch("/job-postings/{job_posting_id}/status", response_model=dict)
async def set_job_posting_status(
    job_posting_id: str,
    body: SetStatusRequest,
    service: ServiceDep,
    user: Annotated[AuthUser, Depends(require_roles("hr"))],
    background_tasks: BackgroundTasks,
    settings: Annotated[Settings, Depends(get_settings)],
    hook: HookDep,
) -> dict:
    try:
        service.set_job_posting_status(
            job_posting_id, body.status, user_id=user.id, role=user.role
        )
    except LookupError:
        raise _NOT_FOUND
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    if body.status == "PUBLISHED":
        # Tin mở nhận hồ sơ là lúc chắc chắn cần vector: CV đầu tiên có thể về
        # ngay sau đó.
        _schedule_embedding(background_tasks, hook, job_posting_id, settings)
    return {"status": body.status}


@router.get("/job-postings/{job_posting_id}/ranking", response_model=List[RankedCandidate])
async def rank_candidates(
    job_posting_id: str,
    service: ServiceDep,
    user: Annotated[AuthUser, Depends(require_operational_roles())],
) -> List[RankedCandidate]:
    """Ứng viên của tin, xếp theo điểm khớp CV↔tin do pipeline tính.

    Cả HR (chủ tin) lẫn tech lead (trong hội đồng) đều đọc được; tech lead
    nhận bản đã che danh tính.
    """
    try:
        return service.rank_candidates(job_posting_id, user_id=user.id, role=user.role)
    except LookupError:
        raise _NOT_FOUND


@router.post("/job-postings/{job_posting_id}/duplicate", response_model=JobPostingSummary)
async def duplicate_job_posting(
    job_posting_id: str,
    service: ServiceDep,
    user: Annotated[AuthUser, Depends(require_roles("hr"))],
) -> JobPostingSummary:
    try:
        return service.duplicate_job_posting(
            job_posting_id, user_id=user.id, role=user.role
        )
    except LookupError:
        raise _NOT_FOUND


def _schedule_embedding(background_tasks: BackgroundTasks, hook, job_id, settings: Settings) -> None:
    if job_id:
        background_tasks.add_task(hook, str(job_id), settings)


@router.get("/analytics", response_model=AnalyticsData)
async def get_analytics(
    service: ServiceDep,
    user: Annotated[AuthUser, Depends(require_operational_roles())],
) -> AnalyticsData:
    """Số liệu tổng hợp trong phạm vi của người gọi. Không mang tên hay email."""
    return service.get_analytics(user_id=user.id, role=user.role)
