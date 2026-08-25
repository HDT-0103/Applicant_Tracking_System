"""Luật duyệt CV của hội đồng — NƠI DUY NHẤT giữ các con số.

Trước đây tỉ lệ 80% nằm rải rác: một bản trong `review_service`, một bản chép
tay trong `ReviewPanel.tsx`. Hai chỗ chỉ cần lệch nhau một lần là UI nói một
đằng, backend chốt một nẻo — mà người dùng không có cách nào biết.

Vì vậy backend không chỉ giữ tỉ lệ, nó còn TÍNH SẴN số phiếu cần thiết và trả
về trong `ReviewStatus`. Frontend hiển thị con số nhận được chứ không tự nhân
chia, nên không thể lệch.
"""

import math

#: Tỉ lệ Tech Lead phải duyệt thì hồ sơ mới sang HR. Team chốt 80%.
TL_APPROVAL_RATIO = 0.8

#: Quá tỉ lệ này Tech Lead từ chối thì hồ sơ trượt luôn, không cần chờ đủ phiếu.
#: Là phần bù của ngưỡng duyệt: quá 20% từ chối thì 80% duyệt là bất khả thi.
TL_REJECTION_RATIO = 1 - TL_APPROVAL_RATIO


def required_approvals(panel_size: int) -> int:
    """Số phiếu duyệt tối thiểu cho một hội đồng *panel_size* người.

    Làm tròn LÊN: hội đồng 3 người thì 80% là 2.4 phiếu, mà không ai bỏ được
    0.4 phiếu — lấy 3. Làm tròn xuống sẽ hạ ngưỡng thật xuống dưới mức team đã
    chốt đúng ở những hội đồng nhỏ, tức là nơi mỗi phiếu nặng nhất.
    """
    return math.ceil(max(panel_size, 1) * TL_APPROVAL_RATIO)


def blocking_rejections(panel_size: int) -> int:
    """Số phiếu từ chối đủ để loại hồ sơ ngay.

    Bằng "số người còn lại không thể bù nổi ngưỡng duyệt" — suy ra từ
    `required_approvals` chứ không tính riêng, để hai con số không bao giờ mâu
    thuẫn (ví dụ vừa đủ trượt lại vừa đủ đậu).
    """
    size = max(panel_size, 1)
    return size - required_approvals(size) + 1


def rule_text(panel_size: int) -> str:
    """Câu mô tả luật để hiển thị cho người dùng.

    Người duyệt phải đọc được luật ngay tại chỗ bấm nút, không phải đi hỏi.
    """
    need = required_approvals(panel_size)
    return (
        f"{need}/{max(panel_size, 1)} Tech Lead phải duyệt "
        f"({int(TL_APPROVAL_RATIO * 100)}%), sau đó HR chốt."
    )
