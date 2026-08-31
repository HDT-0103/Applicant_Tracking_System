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

class PanelMember(BaseModel):
    """Một Tech Lead được HR mời vào hội đồng của một tin tuyển dụng."""

    reviewer_id: str
    name: str
    email: str
    invited_at: str


class TLReviewSummary(BaseModel):
    reviewer_id: str
    decision: ReviewDecision
    review_text: str

#: Các trạng thái tổng hợp có thể xảy ra. Là Literal chứ không phải str tự do:
#: frontend switch trên đúng những giá trị này, thêm nhánh mới mà quên sửa UI
#: thì mypy/pydantic báo ngay thay vì render ra ô trống.
OverallStatus = Literal[
    "waiting_for_tls",
    "rejected_by_tls",
    "waiting_for_hr",
    "rejected_by_hr",
    "ready_to_schedule",
]


class ReviewStatus(BaseModel):
    candidate_uuid: str
    hr_decision: ReviewDecision = "pending"
    hr_review_text: str = ""
    tl_reviews: List[TLReviewSummary] = Field(default_factory=list)
    total_tls: int = 1
    approved_tls: int = 0
    rejected_tls: int = 0
    #: Số phiếu duyệt cần có, backend tính sẵn từ policy. Frontend hiển thị
    #: thẳng con số này thay vì tự nhân 0.8 — xem review/domain/policy.py.
    required_tl_approvals: int = 1
    #: Câu mô tả luật, để người duyệt đọc được ngay tại chỗ bấm nút.
    panel_rule: str = ""
    overall_status: OverallStatus = "waiting_for_tls"
