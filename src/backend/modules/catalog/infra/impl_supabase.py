"""Đọc dữ liệu danh sách từ Supabase bằng khoá service-role.

Khoá service-role bỏ qua RLS. Điều đó CHỈ an toàn vì mọi truy vấn ở đây đã đi
qua `require_roles` ở tầng route và qua lọc hội đồng ở tầng service — quyền
được quyết ở ứng dụng chứ không ở cơ sở dữ liệu. Đừng thêm hàm nào vào file
này mà thiếu một trong hai lớp đó.
"""

from typing import Any, Dict, List, Optional, Sequence

import structlog
from supabase import Client

from modules.catalog.domain.models import (
    CandidateCard,
    CandidateOption,
    ConfirmedSlotSummary,
    JobPostingSummary,
)

logger = structlog.get_logger(__name__)


def _first(value: Any) -> Optional[dict]:
    """PostgREST trả quan hệ `!left` dưới dạng list, kể cả khi chỉ có một dòng."""
    if isinstance(value, list):
        return value[0] if value else None
    return value if isinstance(value, dict) else None


class SupabaseCatalogRepo:
    def __init__(self, client: Client) -> None:
        self._client = client

    # ── Tin tuyển dụng ─────────────────────────────────────────────────────

    def list_job_postings(
        self, job_posting_ids: Optional[Sequence[str]] = None
    ) -> List[JobPostingSummary]:
        """Tin tuyển dụng. `job_posting_ids` giới hạn theo phạm vi của người gọi.

        `None` = không giới hạn (admin). Danh sách rỗng thì service đã trả về
        rỗng trước khi tới đây — `in_("id", [])` của PostgREST không đáng tin.
        """
        query = self._client.table("jobs_posting").select("id, job_title, status")
        if job_posting_ids is not None:
            query = query.in_("id", list(job_posting_ids))
        jobs = query.order("created_at", desc=True).execute()

        counts: Dict[str, int] = {}
        apps_query = (
            self._client.table("applications")
            .select("job_posting_id")
            .not_.is_("job_posting_id", "null")
        )
        if job_posting_ids is not None:
            apps_query = apps_query.in_("job_posting_id", list(job_posting_ids))
        apps = apps_query.execute()
        for row in apps.data or []:
            job_id = row.get("job_posting_id")
            if job_id:
                counts[job_id] = counts.get(job_id, 0) + 1

        return [
            JobPostingSummary(
                id=row["id"],
                job_title=row.get("job_title") or "Untitled",
                status=row.get("status") or "DRAFT",
                applicant_count=counts.get(row["id"], 0),
            )
            for row in jobs.data or []
        ]

    def create_job_posting(self, payload: dict) -> dict:
        res = self._client.table("jobs_posting").insert(payload).execute()
        return (res.data or [{}])[0]

    def update_job_posting(self, job_posting_id: str, payload: dict) -> dict:
        res = (
            self._client.table("jobs_posting")
            .update(payload)
            .eq("id", job_posting_id)
            .execute()
        )
        return (res.data or [{}])[0]

    def get_job_posting(self, job_posting_id: str) -> Optional[dict]:
        res = (
            self._client.table("jobs_posting")
            .select("*")
            .eq("id", job_posting_id)
            .limit(1)
            .execute()
        )
        return (res.data or [None])[0]

    def get_user_summary(self, user_id: str) -> Optional[dict]:
        """Tên và công ty của người tạo tin — để trang chi tiết ghi "đăng bởi".

        Chỉ hai cột đó: email hay role của HR không có lý do gì đi ra trang
        tin tuyển dụng mà tech lead cũng đọc được.
        """
        res = (
            self._client.table("users")
            .select("id, name, company_name")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        return (res.data or [None])[0]

    def set_job_posting_status(self, job_posting_id: str, status: str) -> None:
        self._client.table("jobs_posting").update({"status": status}).eq(
            "id", job_posting_id
        ).execute()

    def duplicate_job_posting(
        self, job_posting_id: str, created_by: str
    ) -> JobPostingSummary:
        original = self.get_job_posting(job_posting_id)
        if original is None:
            raise LookupError(job_posting_id)

        payload = {
            k: v
            for k, v in original.items()
            if k not in {"id", "created_at", "last_saved_at", "posted_at"}
        }
        payload["job_title"] = f"{original.get('job_title') or 'Untitled'} (Copy)"
        # Bản sao thuộc về người nhân bản, không kế thừa chủ của bản gốc — nếu
        # không thì người vừa bấm Duplicate sẽ không thấy bản sao trong danh
        # sách của mình.
        payload["created_by"] = created_by
        # Bản sao luôn là DRAFT: hội đồng KHÔNG được sao chép theo, nên đăng
        # ngay sẽ là một tin không ai chấm được.
        payload["status"] = "DRAFT"

        inserted = (
            self._client.table("jobs_posting")
            .insert(payload)
            .execute()
        )
        row = (inserted.data or [{}])[0]
        return JobPostingSummary(
            id=row["id"],
            job_title=row.get("job_title") or "Untitled",
            status=row.get("status") or "DRAFT",
            applicant_count=0,
        )

    def count_panel(self, job_posting_id: str) -> int:
        res = (
            self._client.table("job_posting_reviewers")
            .select("reviewer_id", count="exact")
            .eq("job_posting_id", job_posting_id)
            .execute()
        )
        return res.count or 0

    def delete_job_posting(self, job_posting_id: str) -> None:
        self._client.table("jobs_posting").delete().eq("id", job_posting_id).execute()

    # ── Ứng viên ───────────────────────────────────────────────────────────

    def list_candidate_cards(
        self, limit: int, job_posting_ids: Optional[Sequence[str]] = None
    ) -> List[CandidateCard]:
        """Ứng viên gần đây. `job_posting_ids` giới hạn theo hội đồng của người gọi."""
        query = self._client.table("candidates").select(
            "uuid, full_name, email, created_at, current_company, current_location,"
            " applications!left(job_posting_id, jobs_posting!left(job_title)),"
            " enrichment_profiles!left(match_confidence_score, skill_matrix),"
            " github_profiles!left(public_repos_count, top_languages)"
        )
        rows = query.order("created_at", desc=True).limit(limit).execute().data or []

        allowed = set(job_posting_ids) if job_posting_ids is not None else None
        cards: List[CandidateCard] = []
        for row in rows:
            application = _first(row.get("applications")) or {}
            job_posting_id = application.get("job_posting_id")

            # Lọc theo hội đồng NGAY Ở ĐÂY, trước khi dựng model: một ứng viên
            # bị loại phải không bao giờ tồn tại trong response, kể cả dưới
            # dạng bản ghi rỗng.
            if allowed is not None and job_posting_id not in allowed:
                continue

            enrichment = _first(row.get("enrichment_profiles")) or {}
            github = _first(row.get("github_profiles")) or {}
            job = _first(application.get("jobs_posting")) or {}

            cards.append(
                CandidateCard(
                    candidate_uuid=row["uuid"],
                    full_name=row.get("full_name"),
                    email=row.get("email"),
                    created_at=row.get("created_at"),
                    company=row.get("current_company"),
                    current_location=row.get("current_location"),
                    applied_job_title=job.get("job_title"),
                    job_posting_id=job_posting_id,
                    match_confidence_score=enrichment.get("match_confidence_score"),
                    skills_matrix=enrichment.get("skill_matrix"),
                    public_repos_count=github.get("public_repos_count"),
                    top_languages=github.get("top_languages"),
                )
            )
        return cards

    def list_candidate_options(
        self, limit: int, job_posting_ids: Optional[Sequence[str]] = None
    ) -> List[CandidateOption]:
        cards = self.list_candidate_cards(limit=limit, job_posting_ids=job_posting_ids)
        return [
            CandidateOption(candidate_uuid=c.candidate_uuid, full_name=c.full_name)
            for c in cards
        ]

    def list_confirmed_slots(self) -> List[ConfirmedSlotSummary]:
        res = (
            self._client.table("confirmed_slots")
            .select("id, candidate_uuid, start_time, end_time")
            .execute()
        )
        return [
            ConfirmedSlotSummary(
                id=str(row["id"]),
                candidate_uuid=row["candidate_uuid"],
                start_time=row["start_time"],
                end_time=row.get("end_time"),
            )
            for row in res.data or []
        ]

    # ── Phạm vi của người gọi (JobVisibilitySource) ───────────────────────

    def job_postings_created_by(self, user_id: str) -> List[str]:
        res = (
            self._client.table("jobs_posting")
            .select("id")
            .eq("created_by", user_id)
            .execute()
        )
        return [row["id"] for row in res.data or []]

    def job_postings_for_reviewer(self, reviewer_id: str) -> List[str]:
        res = (
            self._client.table("job_posting_reviewers")
            .select("job_posting_id")
            .eq("reviewer_id", reviewer_id)
            .execute()
        )
        return [row["job_posting_id"] for row in res.data or []]

    # ── Analytics ──────────────────────────────────────────────────────────

    def read_analytics(
        self, job_posting_ids: Optional[Sequence[str]] = None
    ) -> tuple[list, list, list]:
        """Số liệu thô, giới hạn theo tin của người gọi (`None` = tất cả)."""
        jobs_query = self._client.table("jobs_posting").select(
            "id, job_title, department, status, must_have_skills,"
            " nice_to_have_skills, created_at"
        )
        if job_posting_ids is not None:
            jobs_query = jobs_query.in_("id", list(job_posting_ids))
        jobs = jobs_query.execute().data or []

        # `candidate_uuid` chỉ để lọc bảng candidates bên dưới theo cùng phạm
        # vi; nó là khoá, không phải danh tính.
        apps_query = self._client.table("applications").select(
            "id, job_posting_id, candidate_uuid, referral_source, experience_bucket,"
            " work_mode_pref, skill_ratings, created_at"
        )
        if job_posting_ids is not None:
            apps_query = apps_query.in_("job_posting_id", list(job_posting_ids))
        applications = apps_query.execute().data or []

        # Chỉ lấy những cột thật sự dùng để đếm. Trước đây màn hình này kéo về
        # cả tên, email, github, linkedin của mọi ứng viên chỉ để hiện ra vài
        # con số tổng — danh tính không cần rời khỏi máy chủ.
        cand_query = self._client.table("candidates").select(
            "uuid, current_location, github_username, linkedin_url"
        )
        if job_posting_ids is not None:
            uuids = sorted({a["candidate_uuid"] for a in applications if a.get("candidate_uuid")})
            if not uuids:
                return jobs, applications, []
            cand_query = cand_query.in_("uuid", uuids)
        candidates = cand_query.execute().data or []

        return jobs, applications, candidates
