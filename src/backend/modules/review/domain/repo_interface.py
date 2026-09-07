from typing import Dict, List, Optional, Sequence, Set

from .models import CvReview, PanelMember


class IReviewRepo:
    async def get_reviews(self, candidate_uuid: str) -> List[CvReview]:
        raise NotImplementedError

    async def get_reviews_for_candidates(
        self, candidate_uuids: Sequence[str]
    ) -> Dict[str, List[CvReview]]:
        """Đọc review của NHIỀU ứng viên trong một lượt.

        Dashboard liệt kê 30 ứng viên; gọi `get_reviews` từng người là 30 vòng
        khứ hồi cho một màn hình. Trả về dict thiếu key cho ứng viên chưa ai
        chấm — caller coi như danh sách rỗng.
        """
        raise NotImplementedError

    async def save_review(self, review: CvReview) -> None:
        raise NotImplementedError

    async def get_panel_size(self, candidate_uuid: str) -> int:
        """Sĩ số hội đồng dùng để tính ngưỡng cho ứng viên này.

        Trả về sĩ số đã CHỐT trên `applications.review_panel_size` nếu hồ sơ đã
        có phiếu đầu tiên; nếu chưa thì đếm hội đồng hiện tại của tin tuyển
        dụng. Chốt rồi mà vẫn đếm lại thì mọi lần HR mời thêm người sẽ hồi tố
        lên hồ sơ đang chấm dở.
        """
        raise NotImplementedError

    async def freeze_panel_size(self, candidate_uuid: str, size: int) -> None:
        """Ghi sĩ số đã chốt, nếu hồ sơ chưa có. Gọi lại lần nữa KHÔNG ghi đè."""
        raise NotImplementedError

    # ── Phạm vi (AsyncJobVisibilitySource) ─────────────────────────────────
    # Bốn câu hỏi thuần dữ liệu. LUẬT ai-thấy-gì không ở đây mà ở
    # `modules/shared/domain/job_visibility.py`; service ghép hai thứ lại.

    async def job_postings_created_by(self, user_id: str) -> List[str]:
        """Tin do *user_id* tạo (`jobs_posting.created_by`)."""
        raise NotImplementedError

    async def job_postings_for_reviewer(self, reviewer_id: str) -> List[str]:
        """Tin mà *reviewer_id* được mời vào hội đồng (`job_posting_reviewers`)."""
        raise NotImplementedError

    async def job_posting_of_candidate(self, candidate_uuid: str) -> Optional[str]:
        """Tin mà ứng viên này nộp vào (đơn mới nhất). None nếu chưa nộp đâu."""
        raise NotImplementedError

    async def applications_for_candidates(
        self, candidate_uuids: Sequence[str]
    ) -> Dict[str, dict]:
        """Đơn ứng tuyển MỚI NHẤT của từng ứng viên, một lượt cho cả lô.

        Trả về ``{candidate_uuid: {"job_posting_id", "review_panel_size"}}``;
        thiếu key = chưa nộp đâu. Dashboard hỏi 20–30 hồ sơ: hỏi từng người
        là 20–30 vòng khứ hồi, mỗi vòng ~160 ms từ Azure sang Supabase.
        """
        raise NotImplementedError

    async def count_panels(self, job_posting_ids: Sequence[str]) -> Dict[str, int]:
        """Sĩ số hội đồng của nhiều tin trong MỘT truy vấn. Tin không có = 0."""
        raise NotImplementedError

    async def candidates_on_job_postings(
        self, candidate_uuids: Sequence[str], job_posting_ids: Sequence[str]
    ) -> Set[str]:
        """Trong *candidate_uuids*, ai đã nộp vào một trong *job_posting_ids*.

        Một lượt cho cả lô: dashboard hỏi 30 hồ sơ một lúc, gọi từng người là
        30 vòng khứ hồi trên đường đi của mọi lần mở trang.
        """
        raise NotImplementedError

    async def get_panel(self, job_posting_id: str) -> List[PanelMember]:
        """Danh sách Tech Lead đang trong hội đồng của một tin tuyển dụng."""
        raise NotImplementedError

    async def reviewers_for_job_postings(self, job_posting_ids: Sequence[str]) -> Set[str]:
        """Mọi reviewer_id trong hội đồng của bất kỳ tin nào trong lô — MỘT truy vấn.

        Trang lịch cần "ai được phỏng vấn cho HR này": gọi `get_panel` theo
        từng tin là N vòng khứ hồi (~160 ms mỗi vòng từ Azure).
        """
        raise NotImplementedError

    async def list_available_reviewers(self) -> List[PanelMember]:
        """Mọi Tech Lead còn hoạt động — nguồn để HR chọn người mời.

        Chỉ trả tên và email. HR cần đúng ngần đó để chọn đúng người; phần còn
        lại của bảng `users` không liên quan gì tới việc lập hội đồng.
        """
        raise NotImplementedError

    async def add_panel_member(
        self, job_posting_id: str, reviewer_id: str, invited_by: str
    ) -> None:
        raise NotImplementedError

    async def remove_panel_member(self, job_posting_id: str, reviewer_id: str) -> None:
        raise NotImplementedError

    async def count_panel(self, job_posting_id: str) -> int:
        """Sĩ số hội đồng hiện tại của một tin tuyển dụng."""
        raise NotImplementedError

    async def set_application_status(self, candidate_uuid: str, status: str) -> None:
        """Ghi kết quả cuối cùng sang bảng `applications`."""
        raise NotImplementedError
