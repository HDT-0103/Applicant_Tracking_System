"""Dữ liệu cho các màn hình danh sách, đã lọc quyền và đã che PII.

Toàn bộ lý do module này tồn tại: trước đây trình duyệt hỏi thẳng PostgREST
bằng anon key. Không có RLS thì bất kỳ ai cũng đọc được cả bảng; mà bật RLS lên
thì các màn hình chết, vì Supabase không giải mã được JWT của ứng dụng (app ký
bằng khoá riêng, không dùng Supabase Auth). Đưa đường đọc về đây gỡ được cả hai:
quyền do ứng dụng quyết, và cơ sở dữ liệu có thể khoá lại hoàn toàn.
"""

from typing import List, Optional

import structlog

from datetime import datetime, timezone

from modules.catalog.domain.models import (
    AnalyticsData,
    CandidateOption,
    DashboardData,
    JobPostingDraft,
    JobPostingSummary,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
from modules.shared.infrastructure.abac import apply_abac

logger = structlog.get_logger(__name__)

#: Dashboard hiển thị bấy nhiêu ứng viên gần nhất.
RECENT_CANDIDATE_LIMIT = 30


class CatalogService:
    def __init__(self, repo) -> None:
        self._repo = repo

    def _visible_job_postings(self, user_id: str, role: str) -> Optional[List[str]]:
        """Tin tuyển dụng mà người này được xem hồ sơ. `None` = không giới hạn.

        `hr` thấy tất cả. `tech_lead` chỉ thấy hồ sơ nộp vào tin mà họ được mời
        chấm — cùng luật với module review, vì đây là cùng một dữ liệu, chỉ
        khác màn hình.
        """
        if role == "hr":
            return None
        return self._repo.job_postings_for_reviewer(user_id)

    def get_dashboard(self, user_id: str, role: str) -> DashboardData:
        allowed = self._visible_job_postings(user_id, role)
        if allowed is not None and not allowed:
            # Chưa được mời vào hội đồng nào: không có hồ sơ nào để xem. Trả về
            # rỗng chứ không trả về tất cả.
            return DashboardData()

        cards = self._repo.list_candidate_cards(
            limit=RECENT_CANDIDATE_LIMIT, job_posting_ids=allowed
        )
        visible = {c.candidate_uuid for c in cards}
        slots = [s for s in self._repo.list_confirmed_slots() if s.candidate_uuid in visible]

        # Che PII theo role. `tech_lead` không thấy tên hay email ứng viên — đây
        # đúng là luật mà `abac.py` giữ, và trước đây đường đọc thẳng PostgREST
        # đi vòng qua nó hoàn toàn.
        masked = [
            type(card)(**apply_abac(card.model_dump(), role)) for card in cards
        ]
        return DashboardData(candidates=masked, slots=slots)

    def list_candidate_options(self, user_id: str, role: str) -> List[CandidateOption]:
        allowed = self._visible_job_postings(user_id, role)
        if allowed is not None and not allowed:
            return []
        options = self._repo.list_candidate_options(
            limit=RECENT_CANDIDATE_LIMIT, job_posting_ids=allowed
        )
        return [
            CandidateOption(**apply_abac(o.model_dump(), role)) for o in options
        ]

    def list_job_postings(self) -> List[JobPostingSummary]:
        return self._repo.list_job_postings()

    def delete_job_posting(self, job_posting_id: str) -> None:
        self._repo.delete_job_posting(job_posting_id)

    def set_job_posting_status(self, job_posting_id: str, status: str) -> None:
        """Đổi trạng thái tin. Mở nhận hồ sơ thì phải có hội đồng chấm.

        Cùng luật với nút Publish ở màn hình tạo tin — nếu chỉ chặn ở đó thì
        menu "Reopen" trong sidebar là đường vòng mở lại một tin không ai chấm
        được.
        """
        if status == "PUBLISHED" and self._repo.count_panel(job_posting_id) == 0:
            raise ValueError(
                "Add at least one Tech Lead to the review panel before publishing "
                "— applications to a posting with no panel cannot be reviewed."
            )
        self._repo.set_job_posting_status(job_posting_id, status)

    def duplicate_job_posting(self, job_posting_id: str) -> JobPostingSummary:
        return self._repo.duplicate_job_posting(job_posting_id)

    def get_job_posting(self, job_posting_id: str) -> dict:
        row = self._repo.get_job_posting(job_posting_id)
        if row is None:
            raise LookupError(job_posting_id)
        return row

    def save_job_posting(
        self, draft: JobPostingDraft, job_posting_id: Optional[str], created_by: str
    ) -> dict:
        """Tạo mới hoặc cập nhật một tin. Luôn lưu ở trạng thái DRAFT.

        Đăng tin là một thao tác RIÊNG (`set_job_posting_status`) vì nó có điều
        kiện: phải có hội đồng chấm. Gộp chung thì một lần lưu nháp vô tình sẽ
        mở tin ra nhận hồ sơ.
        """
        payload = draft.model_dump()
        payload["last_saved_at"] = _now_iso()

        if job_posting_id:
            return self._repo.update_job_posting(job_posting_id, payload)

        payload["status"] = "DRAFT"
        payload["created_by"] = created_by
        return self._repo.create_job_posting(payload)

    def get_analytics(self) -> AnalyticsData:
        jobs, applications, candidates = self._repo.read_analytics()

        locations: dict[str, int] = {}
        for row in candidates:
            location = (row.get("current_location") or "").strip()
            if location:
                locations[location] = locations.get(location, 0) + 1

        return AnalyticsData(
            jobs=jobs,
            applications=applications,
            candidate_count=len(candidates),
            candidates_with_github=sum(1 for c in candidates if c.get("github_username")),
            candidates_with_linkedin=sum(1 for c in candidates if c.get("linkedin_url")),
            locations=locations,
        )
