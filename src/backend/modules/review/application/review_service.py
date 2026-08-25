import uuid
from typing import Dict, List, Sequence

import structlog

from modules.review.domain import policy
from modules.review.domain.models import (
    CvReview,
    OverallStatus,
    ReviewDecision,
    ReviewStatus,
    TLReviewSummary,
)
from modules.review.domain.repo_interface import IReviewRepo

logger = structlog.get_logger(__name__)

#: Trạng thái ghi sang `applications` khi hồ sơ đã có kết luận cuối.
_TERMINAL_STATUS: dict[str, str] = {
    "rejected_by_tls": "REJECTED",
    "rejected_by_hr": "REJECTED",
    "ready_to_schedule": "APPROVED",
}


class ReviewService:
    def __init__(self, repo: IReviewRepo):
        self._repo = repo

    # ── Đọc ────────────────────────────────────────────────────────────────
    # Đường đọc TUYỆT ĐỐI không ghi. Trước đây `_aggregate_status` tiện tay
    # update bảng `applications`, nên một GET /api/review/{uuid} — thứ mà
    # dashboard gọi cho từng ứng viên — lại đi đổi trạng thái hồ sơ. Ghi chỉ
    # xảy ra ở `submit_review`, nơi thực sự có người ra quyết định.

    async def get_status(self, candidate_uuid: str) -> ReviewStatus:
        reviews = await self._repo.get_reviews(candidate_uuid)
        panel_size = await self._repo.get_panel_size(candidate_uuid)
        return self._aggregate(candidate_uuid, reviews, panel_size)

    async def get_statuses(
        self, candidate_uuids: Sequence[str]
    ) -> Dict[str, ReviewStatus]:
        """Trạng thái của nhiều ứng viên trong một lượt, cho dashboard."""
        unique = list(dict.fromkeys(candidate_uuids))
        if not unique:
            return {}

        by_candidate = await self._repo.get_reviews_for_candidates(unique)
        # Hội đồng hôm nay giống nhau cho mọi ứng viên, nhưng vẫn hỏi theo từng
        # người để ngày mai gắn hội đồng theo tin tuyển dụng thì chỗ này đúng sẵn.
        return {
            uuid_: self._aggregate(
                uuid_,
                by_candidate.get(uuid_, []),
                await self._repo.get_panel_size(uuid_),
            )
            for uuid_ in unique
        }

    # ── Ghi ────────────────────────────────────────────────────────────────

    async def submit_review(
        self,
        candidate_uuid: str,
        reviewer_id: str,
        reviewer_role: str,
        decision: ReviewDecision,
        review_text: str = "",
    ) -> ReviewStatus:
        reviews = await self._repo.get_reviews(candidate_uuid)
        panel_size = await self._repo.get_panel_size(candidate_uuid)
        current = self._aggregate(candidate_uuid, reviews, panel_size)

        # Thứ tự duyệt là LÝ DO tồn tại của hai vòng review: nếu HR chốt được
        # trước, vòng kỹ thuật chỉ còn là con dấu đóng lên quyết định đã có.
        # Luật này phải nằm ở backend — frontend có ẩn nút thì gọi thẳng API
        # vẫn qua được.
        if reviewer_role == "hr" and current.overall_status == "waiting_for_tls":
            raise ValueError(
                "The Tech Lead panel must approve first — "
                f"{current.panel_rule}"
            )

        existing = next((r for r in reviews if r.reviewer_id == reviewer_id), None)
        if existing:
            existing.decision = decision
            existing.review_text = review_text
            await self._repo.save_review(existing)
            reviews = [r for r in reviews if r.reviewer_id != reviewer_id] + [existing]
        else:
            new_rev = CvReview(
                id=str(uuid.uuid4()),
                candidate_uuid=candidate_uuid,
                reviewer_id=reviewer_id,
                reviewer_role=reviewer_role,  # "hr" hoặc "tech_lead"
                decision=decision,
                review_text=review_text,
            )
            await self._repo.save_review(new_rev)
            reviews = reviews + [new_rev]

        status = self._aggregate(candidate_uuid, reviews, panel_size)

        app_status = _TERMINAL_STATUS.get(status.overall_status)
        if app_status:
            try:
                await self._repo.set_application_status(candidate_uuid, app_status)
            except Exception as exc:
                # Phiếu đã ghi xong và status trả về vẫn đúng; hỏng ở đây chỉ
                # là bảng `applications` chậm đồng bộ, không đáng làm hỏng cả
                # request của người vừa bấm duyệt.
                logger.error(
                    "review.update_status_failed",
                    candidate_uuid=candidate_uuid,
                    error=str(exc),
                )

        return status

    # ── Tổng hợp ───────────────────────────────────────────────────────────

    def _aggregate(
        self,
        candidate_uuid: str,
        reviews: List[CvReview],
        panel_size: int,
    ) -> ReviewStatus:
        hr = next((r for r in reviews if r.reviewer_role == "hr"), None)
        tl_reviews = [r for r in reviews if r.reviewer_role == "tech_lead"]

        approved_tls = sum(1 for r in tl_reviews if r.decision == "approved")
        rejected_tls = sum(1 for r in tl_reviews if r.decision == "rejected")

        # Hội đồng không bao giờ nhỏ hơn số người đã thực sự bỏ phiếu. Nếu một
        # tech lead bị vô hiệu hoá sau khi chấm, mẫu số tụt xuống và tỉ lệ vọt
        # quá 100% — hồ sơ tự đậu.
        size = max(panel_size, len(tl_reviews), 1)
        need_approve = policy.required_approvals(size)
        need_reject = policy.blocking_rejections(size)

        hr_dec: ReviewDecision = hr.decision if hr else "pending"
        overall: OverallStatus
        if rejected_tls >= need_reject:
            overall = "rejected_by_tls"
        elif approved_tls >= need_approve:
            if hr_dec == "rejected":
                overall = "rejected_by_hr"
            elif hr_dec == "approved":
                overall = "ready_to_schedule"
            else:
                overall = "waiting_for_hr"
        else:
            overall = "waiting_for_tls"

        return ReviewStatus(
            candidate_uuid=candidate_uuid,
            hr_decision=hr_dec,
            hr_review_text=hr.review_text if hr else "",
            tl_reviews=[
                TLReviewSummary(
                    reviewer_id=r.reviewer_id,
                    decision=r.decision,
                    review_text=r.review_text,
                )
                for r in tl_reviews
            ],
            total_tls=size,
            approved_tls=approved_tls,
            rejected_tls=rejected_tls,
            required_tl_approvals=need_approve,
            panel_rule=policy.rule_text(size),
            overall_status=overall,
        )
