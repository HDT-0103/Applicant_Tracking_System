from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from modules.auth.domain.models import AuthUser
from modules.review.application.review_service import ReviewService
from modules.review.domain.models import ReviewDecision, ReviewStatus
from modules.review.infra.impl_inmemory import InMemoryReviewRepo
from modules.shared.infrastructure.auth_dependencies import require_roles

router = APIRouter(prefix="/api/review", tags=["review"])


def _build_service() -> ReviewService:
    return ReviewService(repo=InMemoryReviewRepo())


ServiceDep = Annotated[ReviewService, Depends(_build_service)]


class SubmitReviewRequest(BaseModel):
    decision: ReviewDecision
    review_text: str = ""


class ResolveConflictRequest(BaseModel):
    final_decision: ReviewDecision


@router.post("/{candidate_uuid}", response_model=ReviewStatus)
async def submit_review(
    candidate_uuid: str,
    body: SubmitReviewRequest,
    service: ServiceDep,
    current_user: Annotated[AuthUser, Depends(require_roles("hr", "tech_lead", "admin"))],
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
    _current_user: Annotated[AuthUser, Depends(require_roles("hr", "tech_lead", "admin"))],
) -> ReviewStatus:
    return await service.get_status(candidate_uuid)


@router.post("/{candidate_uuid}/resolve", response_model=ReviewStatus)
async def resolve_conflict(
    candidate_uuid: str,
    body: ResolveConflictRequest,
    service: ServiceDep,
    current_user: Annotated[AuthUser, Depends(require_roles("hr", "admin"))],
) -> ReviewStatus:
    if current_user.role not in ("hr", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR can resolve conflicts",
        )
    return await service.resolve_conflict(
        candidate_uuid=candidate_uuid,
        hr_final_decision=body.final_decision,
    )
