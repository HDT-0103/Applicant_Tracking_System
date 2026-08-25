from typing import List

from modules.review.domain.models import CvReview
from modules.review.domain.repo_interface import IReviewRepo
from supabase import Client

class SupabaseReviewRepo(IReviewRepo):
    def __init__(self, supabase_client: Client):
        self._client = supabase_client

    async def get_reviews(self, candidate_uuid: str) -> List[CvReview]:
        res = self._client.table("cv_reviews").select("*").eq("candidate_uuid", candidate_uuid).execute()
        reviews = []
        for row in res.data:
            reviews.append(
                CvReview(
                    id=row["id"],
                    candidate_uuid=row["candidate_uuid"],
                    reviewer_id=row["reviewer_id"],
                    reviewer_role=row["reviewer_role"],
                    decision=row["decision"],
                    review_text=row.get("review_text") or "",
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                )
            )
        return reviews

    async def save_review(self, review: CvReview) -> None:
        data = {
            "id": review.id,
            "candidate_uuid": review.candidate_uuid,
            "reviewer_id": review.reviewer_id,
            "reviewer_role": review.reviewer_role,
            "decision": review.decision,
            "review_text": review.review_text,
            "created_at": review.created_at,
            "updated_at": review.updated_at,
        }
        self._client.table("cv_reviews").upsert(data).execute()

    async def get_total_tech_leads(self) -> int:
        res = self._client.table("users").select("id", count="exact").eq("role", "tech_lead").execute()
        return res.count or 1
