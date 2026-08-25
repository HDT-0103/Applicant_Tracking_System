from datetime import datetime, timezone
from typing import Literal, Optional, List

from pydantic import BaseModel, Field

ReviewDecision = Literal["pending", "approved", "rejected"]
ReviewerRole = Literal["hr", "tech_lead"]

class CvReview(BaseModel):
    id: str
    candidate_uuid: str
    reviewer_id: str
    reviewer_role: ReviewerRole
    decision: ReviewDecision = "pending"
    review_text: str = ""
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

class TLReviewSummary(BaseModel):
    reviewer_id: str
    decision: ReviewDecision
    review_text: str

class ReviewStatus(BaseModel):
    candidate_uuid: str
    hr_decision: ReviewDecision = "pending"
    hr_review_text: str = ""
    tl_reviews: List[TLReviewSummary] = Field(default_factory=list)
    total_tls: int = 1
    approved_tls: int = 0
    rejected_tls: int = 0
    overall_status: str = "waiting_for_tls"
