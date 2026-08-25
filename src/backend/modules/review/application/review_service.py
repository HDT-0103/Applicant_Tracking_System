import uuid
import structlog
from typing import Optional

from modules.review.domain.models import CvReview, ReviewDecision, ReviewStatus, TLReviewSummary
from modules.review.domain.repo_interface import IReviewRepo

logger = structlog.get_logger(__name__)


class ReviewService:
    def __init__(self, repo: IReviewRepo):
        self._repo = repo

    async def get_status(self, candidate_uuid: str) -> ReviewStatus:
        return await self._aggregate_status(candidate_uuid)

    async def submit_review(
        self,
        candidate_uuid: str,
        reviewer_id: str,
        reviewer_role: str,
        decision: ReviewDecision,
        review_text: str = "",
    ) -> ReviewStatus:
        reviews = await self._repo.get_reviews(candidate_uuid)
        
        # Check if already reviewed
        existing = next((r for r in reviews if r.reviewer_id == reviewer_id), None)
        
        if existing:
            existing.decision = decision
            existing.review_text = review_text
            await self._repo.save_review(existing)
        else:
            new_rev = CvReview(
                id=str(uuid.uuid4()),
                candidate_uuid=candidate_uuid,
                reviewer_id=reviewer_id,
                reviewer_role=reviewer_role,  # "hr" or "tech_lead"
                decision=decision,
                review_text=review_text,
            )
            await self._repo.save_review(new_rev)

        return await self._aggregate_status(candidate_uuid)

    async def resolve_conflict(
        self, candidate_uuid: str, hr_final_decision: ReviewDecision
    ) -> ReviewStatus:
        # Not needed anymore since HR is the final decision maker anyway,
        # but keep it if API expects it. Actually, HR just submits their own review.
        return await self.get_status(candidate_uuid)

    async def _aggregate_status(self, candidate_uuid: str) -> ReviewStatus:
        reviews = await self._repo.get_reviews(candidate_uuid)
        total_tls = await self._repo.get_total_tech_leads()
        
        hr = next((r for r in reviews if r.reviewer_role == "hr"), None)
        tl_reviews = [r for r in reviews if r.reviewer_role == "tech_lead"]
        
        hr_dec = hr.decision if hr else "pending"
        hr_text = hr.review_text if hr else ""
        
        approved_tls = sum(1 for r in tl_reviews if r.decision == "approved")
        rejected_tls = sum(1 for r in tl_reviews if r.decision == "rejected")
        
        tl_summaries = [
            TLReviewSummary(
                reviewer_id=r.reviewer_id,
                decision=r.decision,
                review_text=r.review_text
            ) for r in tl_reviews
        ]

        status = ReviewStatus(
            candidate_uuid=candidate_uuid,
            hr_decision=hr_dec,
            hr_review_text=hr_text,
            tl_reviews=tl_summaries,
            total_tls=total_tls,
            approved_tls=approved_tls,
            rejected_tls=rejected_tls,
            overall_status="waiting_for_tls",
        )

        # Multi-TL Rule:
        if rejected_tls / total_tls > 0.2:
            status.overall_status = "rejected_by_tls"
            self._update_candidate_status(candidate_uuid, "REJECTED")
        elif approved_tls / total_tls >= 0.8:
            # TLs passed, now HR decides
            if hr_dec == "pending":
                status.overall_status = "waiting_for_hr"
            elif hr_dec == "rejected":
                status.overall_status = "rejected_by_hr"
                self._update_candidate_status(candidate_uuid, "REJECTED")
            elif hr_dec == "approved":
                status.overall_status = "ready_to_schedule"
        else:
            status.overall_status = "waiting_for_tls"

        return status

    def _update_candidate_status(self, candidate_uuid: str, status: str) -> None:
        # We need to update applications table. But ReviewService doesn't have a direct repo for applications.
        # We can use supabase client here, but it's cleaner to inject. Since it's a mock method earlier:
        logger.info(
            "review.update_candidate_status",
            candidate_uuid=candidate_uuid,
            status=status,
        )
        try:
            # We assume repo is SupabaseReviewRepo which has _client
            if hasattr(self._repo, '_client'):
                self._repo._client.table('applications').update({"status": status}).eq('candidate_id', candidate_uuid).execute()
        except Exception as e:
            logger.error("review.update_status_failed", error=str(e))
