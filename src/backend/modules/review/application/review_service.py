import uuid
from typing import Dict, List, Optional, Sequence

import structlog

from modules.review.domain import policy
from modules.review.domain.models import (
    CvReview,
    OverallStatus,
    ReviewDecision,
    ReviewStatus,
    TLReviewSummary,
)
from modules.review.domain.models import PanelMember
from modules.review.domain.repo_interface import IReviewRepo
from modules.shared.domain.job_visibility import visible_job_posting_ids_async

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

    # ── Quyền ──────────────────────────────────────────────────────────────

    async def _visible_job_postings(self, user_id: str, role: str) -> Optional[List[str]]:
        """Tin mà người này được thấy. `None` = tất cả. Luật ở job_visibility.py."""
        return await visible_job_posting_ids_async(role, user_id, self._repo)

    async def may_access_job_posting(
        self, job_posting_id: str, user_id: str, role: str
    ) -> bool:
        """Người này có được thấy tin này không (đọc hội đồng, mở trang tin)?"""
        allowed = await self._visible_job_postings(user_id, role)
        return allowed is None or job_posting_id in allowed

    async def may_access_candidate(self, candidate_uuid: str, user_id: str, role: str) -> bool:
        """Người này có được XEM hồ sơ ứng viên này không?

        Hồ sơ đi theo tin: `hr` thấy hồ sơ nộp vào tin MÌNH tạo, `tech_lead`
        thấy hồ sơ nộp vào tin mình được mời chấm. Trước đây `hr` là `True`
        vô điều kiện — mọi HR trong hệ thống đọc được PII của mọi ứng viên,
        kể cả của công ty khác.

        Vai trò lạ trả về False. Fail-closed: thêm một role mới mà quên khai ở
        job_visibility.py thì nó KHÔNG được cấp quyền theo mặc định.
        """
        allowed = await self._visible_job_postings(user_id, role)
        if allowed is None:
            return True
        if not allowed:
            return False
        job_posting_id = await self._repo.job_posting_of_candidate(candidate_uuid)
        return job_posting_id is not None and job_posting_id in allowed

    # ── Hội đồng ───────────────────────────────────────────────────────────

    async def get_panel(self, job_posting_id: str) -> List[PanelMember]:
        return await self._repo.get_panel(job_posting_id)

    async def list_available_reviewers(self) -> List[PanelMember]:
        return await self._repo.list_available_reviewers()

    async def invite_reviewer(
        self, job_posting_id: str, reviewer_id: str, invited_by: str
    ) -> List[PanelMember]:
        await self._repo.add_panel_member(job_posting_id, reviewer_id, invited_by)
        return await self._repo.get_panel(job_posting_id)

    async def remove_reviewer(
        self, job_posting_id: str, reviewer_id: str
    ) -> List[PanelMember]:
        await self._repo.remove_panel_member(job_posting_id, reviewer_id)
        return await self._repo.get_panel(job_posting_id)

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
        self, candidate_uuids: Sequence[str], user_id: str, role: str
    ) -> Dict[str, ReviewStatus]:
        """Trạng thái của nhiều ứng viên trong một lượt, cho dashboard.

        Lọc theo quyền trước khi đọc: hồ sơ mà người gọi không được xem thì
        KHÔNG có mặt trong kết quả — không phải trả về rỗng, mà là vắng hẳn.
        Một mục "đang chờ hội đồng" cho ứng viên lạ vẫn tiết lộ rằng người đó
        có ứng tuyển.
        """
        unique = list(dict.fromkeys(candidate_uuids))
        if not unique:
            return {}

        allowed_jobs = await self._visible_job_postings(user_id, role)
        if allowed_jobs is not None:
            if not allowed_jobs:
                return {}
            accessible = await self._repo.candidates_on_job_postings(unique, allowed_jobs)
            unique = [u for u in unique if u in accessible]

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
        # Chỉ người trong hội đồng mới bỏ phiếu được. Kiểm ở đây chứ không chỉ
        # ẩn nút: gọi thẳng API vẫn qua được nếu chỉ chặn ở giao diện.
        if not await self.may_access_candidate(candidate_uuid, reviewer_id, reviewer_role):
            raise PermissionError(
                "You are not on the review panel for this candidate's job posting."
            )

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

        # CHỐT sĩ số tại lá phiếu đầu tiên, trước khi ghi phiếu đó. Từ giây này
        # trở đi, HR mời thêm hay gỡ bớt tech lead không còn đổi được ngưỡng
        # của hồ sơ đang chấm dở.
        if not reviews and panel_size > 0:
            await self._repo.freeze_panel_size(candidate_uuid, panel_size)

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
        size = max(panel_size, len(tl_reviews))
        if size == 0:
            # Tin tuyển dụng chưa mời tech lead nào. KHÔNG quy về hội đồng một
            # người: như thế thì "chưa ai được giao chấm" trông giống hệt "hội
            # đồng nhỏ", và hồ sơ có thể đậu bằng đúng một phiếu vu vơ. Đứng im
            # ở waiting_for_tls và nói rõ vì sao.
            return ReviewStatus(
                candidate_uuid=candidate_uuid,
                hr_decision=hr.decision if hr else "pending",
                hr_review_text=hr.review_text if hr else "",
                tl_reviews=[],
                total_tls=0,
                approved_tls=0,
                rejected_tls=0,
                required_tl_approvals=0,
                panel_rule=(
                    "This job posting has no Tech Lead panel yet. HR must "
                    "invite reviewers before applications can move forward."
                ),
                overall_status="waiting_for_tls",
            )

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
