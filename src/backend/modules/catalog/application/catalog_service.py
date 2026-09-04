"""Dữ liệu cho các màn hình danh sách, đã lọc quyền và đã che PII.

Toàn bộ lý do module này tồn tại: trước đây trình duyệt hỏi thẳng PostgREST
bằng anon key. Không có RLS thì bất kỳ ai cũng đọc được cả bảng; mà bật RLS lên
thì các màn hình chết, vì Supabase không giải mã được JWT của ứng dụng (app ký
bằng khoá riêng, không dùng Supabase Auth). Đưa đường đọc về đây gỡ được cả hai:
quyền do ứng dụng quyết, và cơ sở dữ liệu có thể khoá lại hoàn toàn.

Mọi thao tác trên một tin tuyển dụng đều đi qua `_require_visible` trước. Tin
không thuộc phạm vi của người gọi được coi là KHÔNG TỒN TẠI (LookupError →
404), không phải "bị cấm" (403): 403 xác nhận tin đó có thật.
"""

from datetime import datetime, timezone
from typing import List, Optional

import structlog

from modules.catalog.domain.models import (
    AnalyticsData,
    CandidateOption,
    DashboardData,
    JobPostingDraft,
    JobPostingSummary,
)
from modules.shared.domain.job_visibility import visible_job_posting_ids
from modules.shared.infrastructure.abac import apply_abac

logger = structlog.get_logger(__name__)

#: Dashboard hiển thị bấy nhiêu ứng viên gần nhất.
RECENT_CANDIDATE_LIMIT = 30


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class CatalogService:
    def __init__(self, repo) -> None:
        self._repo = repo

    # ── Phạm vi ────────────────────────────────────────────────────────────

    def _visible_job_postings(self, user_id: str, role: str) -> Optional[List[str]]:
        """Tin tuyển dụng mà người này được thấy. `None` = không giới hạn.

        Luật nằm ở `modules/shared/domain/job_visibility.py`: `hr` thấy tin
        mình tạo, `tech_lead` thấy tin mình được mời chấm. Trước đây `hr` trả
        về `None` ở đây — mọi HR, kể cả tài khoản vừa đăng ký, thấy toàn bộ
        dữ liệu của mọi người.
        """
        return visible_job_posting_ids(role, user_id, self._repo)

    def _require_visible(self, job_posting_id: str, user_id: str, role: str) -> None:
        allowed = self._visible_job_postings(user_id, role)
        if allowed is not None and job_posting_id not in allowed:
            raise LookupError(job_posting_id)

    # ── Ứng viên ───────────────────────────────────────────────────────────

    def get_dashboard(self, user_id: str, role: str) -> DashboardData:
        allowed = self._visible_job_postings(user_id, role)
        if allowed is not None and not allowed:
            # Chưa tạo tin nào / chưa được mời vào hội đồng nào: không có hồ sơ
            # nào để xem. Trả về rỗng chứ không trả về tất cả.
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

    # ── Tin tuyển dụng ─────────────────────────────────────────────────────

    def list_job_postings(self, user_id: str, role: str) -> List[JobPostingSummary]:
        allowed = self._visible_job_postings(user_id, role)
        if allowed is not None and not allowed:
            return []
        return self._repo.list_job_postings(job_posting_ids=allowed)

    def get_job_posting(self, job_posting_id: str, user_id: str, role: str) -> dict:
        self._require_visible(job_posting_id, user_id, role)
        row = self._repo.get_job_posting(job_posting_id)
        if row is None:
            raise LookupError(job_posting_id)

        # "Đăng bởi <tên> · <công ty>" cho trang chi tiết. Là thông tin hiển
        # thị thuần tuý: hỏng ở đây (V009 chưa chạy, user đã bị xoá) không được
        # làm cả trang tin chết theo.
        row = dict(row)
        row.setdefault("created_by_name", None)
        row.setdefault("created_by_company", None)
        owner_id = row.get("created_by")
        if owner_id:
            try:
                owner = self._repo.get_user_summary(owner_id) or {}
            except Exception as exc:  # noqa: BLE001 — chỉ là trường hiển thị
                logger.warning("catalog.owner_lookup_failed", job_posting_id=job_posting_id, error=str(exc))
                owner = {}
            row["created_by_name"] = owner.get("name")
            row["created_by_company"] = owner.get("company_name")
        return row

    def save_job_posting(
        self,
        draft: JobPostingDraft,
        job_posting_id: Optional[str],
        user_id: str,
        role: str,
    ) -> dict:
        """Tạo mới hoặc cập nhật một tin. Luôn lưu ở trạng thái DRAFT.

        Đăng tin là một thao tác RIÊNG (`set_job_posting_status`) vì nó có điều
        kiện: phải có hội đồng chấm. Gộp chung thì một lần lưu nháp vô tình sẽ
        mở tin ra nhận hồ sơ.
        """
        payload = draft.model_dump()
        payload["last_saved_at"] = _now_iso()

        if job_posting_id:
            self._require_visible(job_posting_id, user_id, role)
            return self._repo.update_job_posting(job_posting_id, payload)

        payload["status"] = "DRAFT"
        payload["created_by"] = user_id
        return self._repo.create_job_posting(payload)

    def delete_job_posting(self, job_posting_id: str, user_id: str, role: str) -> None:
        self._require_visible(job_posting_id, user_id, role)
        self._repo.delete_job_posting(job_posting_id)

    def set_job_posting_status(
        self, job_posting_id: str, status: str, user_id: str, role: str
    ) -> None:
        """Đổi trạng thái tin. Mở nhận hồ sơ thì phải có hội đồng chấm.

        Cùng luật với nút Publish ở màn hình tạo tin — nếu chỉ chặn ở đó thì
        menu "Reopen" trong sidebar là đường vòng mở lại một tin không ai chấm
        được.
        """
        self._require_visible(job_posting_id, user_id, role)
        if status == "PUBLISHED" and self._repo.count_panel(job_posting_id) == 0:
            raise ValueError(
                "Add at least one Tech Lead to the review panel before publishing "
                "— applications to a posting with no panel cannot be reviewed."
            )
        self._repo.set_job_posting_status(job_posting_id, status)

    def duplicate_job_posting(
        self, job_posting_id: str, user_id: str, role: str
    ) -> JobPostingSummary:
        self._require_visible(job_posting_id, user_id, role)
        # Bản sao thuộc về người NHÂN BẢN. Trước đây nó kế thừa `created_by`
        # của bản gốc, nên người vừa tạo ra nó lại không thấy nó.
        return self._repo.duplicate_job_posting(job_posting_id, created_by=user_id)

    # ── Analytics ──────────────────────────────────────────────────────────

    def get_analytics(self, user_id: str, role: str) -> AnalyticsData:
        allowed = self._visible_job_postings(user_id, role)
        if allowed is not None and not allowed:
            return AnalyticsData()

        jobs, applications, candidates = self._repo.read_analytics(job_posting_ids=allowed)

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
