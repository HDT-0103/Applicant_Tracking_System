from typing import Dict, List, Optional, Sequence, Set

from supabase import Client

from modules.review.domain.models import CvReview, PanelMember
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

    # ── Hội đồng theo tin tuyển dụng ───────────────────────────────────

    async def _get_application(self, candidate_uuid: str) -> Optional[dict]:
        """Đơn ứng tuyển mới nhất của ứng viên: nguồn của cả job lẫn sĩ số chốt."""
        res = (
            self._client.table("applications")
            .select("id, job_posting_id, review_panel_size")
            .eq("candidate_uuid", candidate_uuid)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return (res.data or [None])[0]

    async def count_panel(self, job_posting_id: str) -> int:
        res = (
            self._client.table("job_posting_reviewers")
            .select("reviewer_id", count="exact")
            .eq("job_posting_id", job_posting_id)
            .execute()
        )
        return res.count or 0

    async def get_panel_size(self, candidate_uuid: str) -> int:
        application = await self._get_application(candidate_uuid)
        if not application:
            # Không có đơn ứng tuyển thì không có tin tuyển dụng, không có hội
            # đồng. Trả 0; service quy ra "chưa chấm được" chứ không tự đậu.
            return 0

        frozen = application.get("review_panel_size")
        if frozen:
            return frozen

        job_posting_id = application.get("job_posting_id")
        if not job_posting_id:
            return 0
        return await self.count_panel(job_posting_id)

    async def freeze_panel_size(self, candidate_uuid: str, size: int) -> None:
        application = await self._get_application(candidate_uuid)
        if not application or application.get("review_panel_size"):
            # Đã chốt rồi thì thôi. Ghi đè sẽ làm đúng cái việc mà cột này sinh
            # ra để ngăn: đổi ngưỡng của một hồ sơ đang chấm dở.
            return

        self._client.table("applications").update(
            {"review_panel_size": size}
        ).eq("id", application["id"]).execute()

    async def is_panel_member(self, candidate_uuid: str, reviewer_id: str) -> bool:
        application = await self._get_application(candidate_uuid)
        job_posting_id = application.get("job_posting_id") if application else None
        if not job_posting_id:
            return False

        res = (
            self._client.table("job_posting_reviewers")
            .select("reviewer_id")
            .eq("job_posting_id", job_posting_id)
            .eq("reviewer_id", reviewer_id)
            .limit(1)
            .execute()
        )
        return bool(res.data)

    async def filter_accessible(
        self, candidate_uuids: Sequence[str], reviewer_id: str
    ) -> Set[str]:
        if not candidate_uuids:
            return set()

        # (1) những tin tuyển dụng người này được mời chấm
        panels = (
            self._client.table("job_posting_reviewers")
            .select("job_posting_id")
            .eq("reviewer_id", reviewer_id)
            .execute()
        )
        job_ids = [row["job_posting_id"] for row in panels.data or []]
        if not job_ids:
            return set()

        # (2) trong danh sách được hỏi, ai nộp vào những tin đó
        apps = (
            self._client.table("applications")
            .select("candidate_uuid")
            .in_("candidate_uuid", list(candidate_uuids))
            .in_("job_posting_id", job_ids)
            .execute()
        )
        return {row["candidate_uuid"] for row in apps.data or []}

    async def get_panel(self, job_posting_id: str) -> List[PanelMember]:
        res = (
            self._client.table("job_posting_reviewers")
            .select("reviewer_id, invited_at, users!job_posting_reviewers_reviewer_id_fkey(name, email)")
            .eq("job_posting_id", job_posting_id)
            .execute()
        )

        members = []
        for row in res.data or []:
            user = row.get("users") or {}
            members.append(
                PanelMember(
                    reviewer_id=row["reviewer_id"],
                    name=user.get("name") or "Unknown",
                    email=user.get("email") or "",
                    invited_at=row["invited_at"],
                )
            )
        return members

    async def list_available_reviewers(self) -> List[PanelMember]:
        res = (
            self._client.table("users")
            .select("id, name, email")
            .eq("role", "tech_lead")
            .eq("is_active", True)
            .eq("is_approved", True)
            .order("name")
            .execute()
        )
        return [
            PanelMember(
                reviewer_id=row["id"],
                name=row.get("name") or "Unknown",
                email=row.get("email") or "",
                invited_at="",
            )
            for row in res.data or []
        ]

    async def add_panel_member(
        self, job_posting_id: str, reviewer_id: str, invited_by: str
    ) -> None:
        # upsert chứ không insert: mời lại người đã có trong hội đồng là thao
        # tác vô hại, không đáng ném lỗi trùng khoá vào mặt HR.
        self._client.table("job_posting_reviewers").upsert(
            {
                "job_posting_id": job_posting_id,
                "reviewer_id": reviewer_id,
                "invited_by": invited_by,
            },
            on_conflict="job_posting_id,reviewer_id",
        ).execute()

    async def remove_panel_member(self, job_posting_id: str, reviewer_id: str) -> None:
        self._client.table("job_posting_reviewers").delete().eq(
            "job_posting_id", job_posting_id
        ).eq("reviewer_id", reviewer_id).execute()

    async def set_application_status(self, candidate_uuid: str, status: str) -> None:
        self._client.table("applications").update({"status": status}).eq(
            "candidate_uuid", candidate_uuid
        ).execute()
