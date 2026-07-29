from datetime import datetime, timezone
from typing import Literal, Optional

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


class ReviewStatus(BaseModel):
    candidate_uuid: str
    hr_decision: ReviewDecision = "pending"
    tl_decision: ReviewDecision = "pending"
    hr_review_text: str = ""
    tl_review_text: str = ""
    overall_status: str = "waiting"
