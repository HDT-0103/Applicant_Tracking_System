from typing import List

from .models import CvReview


class IReviewRepo:
    async def get_reviews(self, candidate_uuid: str) -> List[CvReview]:
        raise NotImplementedError

    async def save_review(self, review: CvReview) -> None:
        raise NotImplementedError

    async def get_total_tech_leads(self) -> int:
        raise NotImplementedError
