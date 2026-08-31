from typing import Annotated, List

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from modules.auth.domain.models import AuthUser
from modules.catalog.application.catalog_service import CatalogService
from modules.catalog.domain.models import (
    AnalyticsData,
    CandidateOption,
    DashboardData,
    JobPostingDraft,
    JobPostingSummary,
)
from modules.catalog.infra.impl_supabase import SupabaseCatalogRepo
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


@router.get("/dashboard", response_model=DashboardData)
async def get_dashboard(
    service: ServiceDep,
    user: Annotated[AuthUser, Depends(require_operational_roles())],
) -> DashboardData:
    """Ứng viên gần đây + lịch đã đặt, đã lọc hội đồng và đã che PII."""
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
    _user: Annotated[AuthUser, Depends(require_operational_roles())],
) -> List[JobPostingSummary]:
    return service.list_job_postings()


@router.get("/job-postings/{job_posting_id}", response_model=dict)
async def get_job_posting(
    job_posting_id: str,
    service: ServiceDep,
    _user: Annotated[AuthUser, Depends(require_roles("hr"))],
) -> dict:
    try:
        return service.get_job_posting(job_posting_id)
    except LookupError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job posting not found."
        )


@router.post("/job-postings", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_job_posting(
    body: JobPostingDraft,
    service: ServiceDep,
    user: Annotated[AuthUser, Depends(require_roles("hr"))],
) -> dict:
    return service.save_job_posting(body, job_posting_id=None, created_by=user.id)


@router.put("/job-postings/{job_posting_id}", response_model=dict)
async def update_job_posting(
    job_posting_id: str,
    body: JobPostingDraft,
    service: ServiceDep,
    user: Annotated[AuthUser, Depends(require_roles("hr"))],
) -> dict:
    return service.save_job_posting(body, job_posting_id=job_posting_id, created_by=user.id)


@router.delete("/job-postings/{job_posting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job_posting(
    job_posting_id: str,
    service: ServiceDep,
    _user: Annotated[AuthUser, Depends(require_roles("hr"))],
) -> None:
    """Xoá tin tuyển dụng. Chỉ HR — tech lead chấm hồ sơ, không quản tin."""
    service.delete_job_posting(job_posting_id)


class SetStatusRequest(BaseModel):
    status: Literal["DRAFT", "PUBLISHED", "CLOSED"]


@router.patch("/job-postings/{job_posting_id}/status", response_model=dict)
async def set_job_posting_status(
    job_posting_id: str,
    body: SetStatusRequest,
    service: ServiceDep,
    _user: Annotated[AuthUser, Depends(require_roles("hr"))],
) -> dict:
    try:
        service.set_job_posting_status(job_posting_id, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return {"status": body.status}


@router.post("/job-postings/{job_posting_id}/duplicate", response_model=JobPostingSummary)
async def duplicate_job_posting(
    job_posting_id: str,
    service: ServiceDep,
    _user: Annotated[AuthUser, Depends(require_roles("hr"))],
) -> JobPostingSummary:
    try:
        return service.duplicate_job_posting(job_posting_id)
    except LookupError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job posting not found."
        )


@router.get("/analytics", response_model=AnalyticsData)
async def get_analytics(
    service: ServiceDep,
    _user: Annotated[AuthUser, Depends(require_operational_roles())],
) -> AnalyticsData:
    """Số liệu tổng hợp. Không mang tên hay email ra khỏi máy chủ."""
    return service.get_analytics()
