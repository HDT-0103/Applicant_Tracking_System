from typing import Dict, List, Sequence

from .models import CvReview


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
        """Số Tech Lead trong hội đồng chấm ứng viên này.

        Nhận `candidate_uuid` chứ không phải hàm không tham số, vì hội đồng lẽ
        ra phải gắn với tin tuyển dụng. Hôm nay bản Supabase còn đếm chung toàn
        bộ tech lead đang hoạt động; khi có bảng phân công thì chỉ một hàm này
        đổi, service và UI không đụng tới.
        """
        raise NotImplementedError

    async def set_application_status(self, candidate_uuid: str, status: str) -> None:
        """Ghi kết quả cuối cùng sang bảng `applications`."""
        raise NotImplementedError
