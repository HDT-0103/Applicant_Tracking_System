from typing import Dict, List, Sequence

from supabase import Client

from modules.review.domain.models import CvReview
from modules.review.domain.repo_interface import IReviewRepo


def _to_review(row: dict) -> CvReview:
    return CvReview(
        id=row["id"],
        candidate_uuid=row["candidate_uuid"],
        reviewer_id=row["reviewer_id"],
        reviewer_role=row["reviewer_role"],
        decision=row["decision"],
        review_text=row.get("review_text") or "",
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


class SupabaseReviewRepo(IReviewRepo):
    def __init__(self, supabase_client: Client):
        self._client = supabase_client

    async def get_reviews(self, candidate_uuid: str) -> List[CvReview]:
        res = (
            self._client.table("cv_reviews")
            .select("*")
            .eq("candidate_uuid", candidate_uuid)
            .execute()
        )
        return [_to_review(row) for row in res.data or []]

    async def get_reviews_for_candidates(
        self, candidate_uuids: Sequence[str]
    ) -> Dict[str, List[CvReview]]:
        if not candidate_uuids:
            return {}

        res = (
            self._client.table("cv_reviews")
            .select("*")
            .in_("candidate_uuid", list(candidate_uuids))
            .execute()
        )

        grouped: Dict[str, List[CvReview]] = {}
        for row in res.data or []:
            grouped.setdefault(row["candidate_uuid"], []).append(_to_review(row))
        return grouped

    async def save_review(self, review: CvReview) -> None:
        # `cv_reviews` có UNIQUE (candidate_uuid, reviewer_id): upsert theo cặp
        # đó, không theo `id`. Upsert theo `id` sẽ chèn dòng thứ hai cho cùng
        # một người khi họ đổi ý, rồi vướng ràng buộc unique.
        self._client.table("cv_reviews").upsert(
            {
                "id": review.id,
                "candidate_uuid": review.candidate_uuid,
                "reviewer_id": review.reviewer_id,
                "reviewer_role": review.reviewer_role,
                "decision": review.decision,
                "review_text": review.review_text,
                "created_at": review.created_at,
                "updated_at": review.updated_at,
            },
            on_conflict="candidate_uuid,reviewer_id",
        ).execute()

    async def get_panel_size(self, candidate_uuid: str) -> int:
        # Chỉ đếm tech lead CÒN hoạt động và đã được duyệt tài khoản. Đếm cả
        # người đã nghỉ thì mẫu số phình ra và không hồ sơ nào đủ 80%.
        #
        # Vẫn là hội đồng chung toàn hệ thống, chưa gắn theo tin tuyển dụng —
        # xem ghi chú ở IReviewRepo.get_panel_size.
        res = (
            self._client.table("users")
            .select("id", count="exact")
            .eq("role", "tech_lead")
            .eq("is_active", True)
            .eq("is_approved", True)
            .execute()
        )
        return res.count or 1

    async def set_application_status(self, candidate_uuid: str, status: str) -> None:
        self._client.table("applications").update({"status": status}).eq(
            "candidate_id", candidate_uuid
        ).execute()
