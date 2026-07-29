from typing import Optional, Protocol

from modules.review.domain.models import CvReview


class IReviewRepo(Protocol):
    def save(self, review: CvReview) -> CvReview:
        ...

    def get_by_candidate(self, candidate_uuid: str) -> list[CvReview]:
        ...

    def get_by_reviewer(
        self, candidate_uuid: str, reviewer_id: str
    ) -> Optional[CvReview]:
        ...
