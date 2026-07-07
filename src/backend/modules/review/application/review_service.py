import structlog

from modules.review.domain.models import CvReview, ReviewDecision, ReviewStatus
from modules.review.domain.repo_interface import IReviewRepo

logger = structlog.get_logger(__name__)


class ReviewService:
    def __init__(self, repo: IReviewRepo) -> None:
        self._repo = repo

    async def submit_review(
        self,
        candidate_uuid: str,
        reviewer_id: str,
        reviewer_role: str,
        decision: ReviewDecision,
        review_text: str = "",
    ) -> ReviewStatus:
        if reviewer_role == "hr":
            reviews = self._repo.get_by_candidate(candidate_uuid)
            tl_submitted = any(
                r for r in reviews
                if r.reviewer_role == "tech_lead" and r.decision != "pending"
            )
            if not tl_submitted:
                raise ValueError("Tech Lead must submit their review first")

        review = CvReview(
            id="",
            candidate_uuid=candidate_uuid,
            reviewer_id=reviewer_id,
            reviewer_role=reviewer_role,
            decision=decision,
            review_text=review_text,
        )
        self._repo.save(review)
        return await self._compute_status(candidate_uuid)

    async def get_status(self, candidate_uuid: str) -> ReviewStatus:
        return await self._compute_status(candidate_uuid)

    async def resolve_conflict(
        self, candidate_uuid: str, hr_final_decision: ReviewDecision
    ) -> ReviewStatus:
        reviews = self._repo.get_by_candidate(candidate_uuid)
        hr_reviews = [r for r in reviews if r.reviewer_role == "hr"]
        if hr_reviews and hr_final_decision == "rejected":
            self._send_rejection_email(candidate_uuid)
        return await self._compute_status(candidate_uuid)

    async def _compute_status(self, candidate_uuid: str) -> ReviewStatus:
        reviews = self._repo.get_by_candidate(candidate_uuid)
        hr = None
        tl = None
        for r in reviews:
            if r.reviewer_role == "hr":
                hr = r
            elif r.reviewer_role == "tech_lead":
                tl = r

        hr_dec = hr.decision if hr else "pending"
        tl_dec = tl.decision if tl else "pending"
        hr_text = hr.review_text if hr else ""
        tl_text = tl.review_text if tl else ""

        status = ReviewStatus(
            candidate_uuid=candidate_uuid,
            hr_decision=hr_dec,
            tl_decision=tl_dec,
            hr_review_text=hr_text,
            tl_review_text=tl_text,
            overall_status="waiting",
        )

        if hr_dec == "pending" or tl_dec == "pending":
            status.overall_status = "waiting"
        elif hr_dec == "approved" and tl_dec == "approved":
            status.overall_status = "ready_to_schedule"
        elif hr_dec == "rejected" and tl_dec == "rejected":
            self._send_rejection_email(candidate_uuid)
            status.overall_status = "rejected"
        else:
            status.overall_status = "conflict"

        return status

    def _send_rejection_email(self, candidate_uuid: str) -> None:
        logger.info(
            "review.rejection_email.mock",
            candidate_uuid=candidate_uuid,
            message="Your application has been rejected. (Mock — email not sent)",
        )
