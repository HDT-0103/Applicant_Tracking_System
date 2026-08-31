from typing import Dict, List, Sequence, Set

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

    async def is_panel_member(self, candidate_uuid: str, reviewer_id: str) -> bool:
        """Người này có trong hội đồng chấm ứng viên này không?

        Là câu hỏi gác cả quyền XEM chứ không chỉ quyền chấm: hồ sơ ứng viên
        chứa PII, nên tech lead không được mời thì không có lý do nghiệp vụ nào
        để nhìn thấy nó.
        """
        raise NotImplementedError

    async def filter_accessible(
        self, candidate_uuids: Sequence[str], reviewer_id: str
    ) -> Set[str]:
        """Lọc ra những ứng viên mà *reviewer_id* được xem, trong MỘT lượt.

        Bản gọi từng người (`is_panel_member`) đúng cho một hồ sơ, nhưng
        dashboard hỏi 30 hồ sơ một lúc — gọi vòng lặp là 30 vòng khứ hồi trên
        đường đi của mọi lần mở trang.
        """
        raise NotImplementedError

    async def get_panel(self, job_posting_id: str) -> List[PanelMember]:
        """Danh sách Tech Lead đang trong hội đồng của một tin tuyển dụng."""
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
