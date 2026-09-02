"""Lỗi nghiệp vụ của module scheduling.

Tầng application ném những lỗi này; adapter HTTP dịch sang mã trạng thái. Nhờ
vậy service không phải import `HTTPException` — thứ sẽ trói nghiệp vụ vào
FastAPI và làm nó không dùng lại được từ worker hay CLI.
"""


class SchedulingError(Exception):
    """Gốc chung, để caller bắt cả họ khi cần."""


class SlotNotFoundError(SchedulingError):
    """Không có lịch phỏng vấn nào mang id đó."""


class CandidateContactMissingError(SchedulingError):
    """Ứng viên không có email nên không gửi được thông tin phỏng vấn."""


class NotificationNotSentError(SchedulingError):
    """Soạn xong nhưng không gửi được — thường là chưa cấu hình SMTP.

    Là lỗi riêng chứ không gộp vào lỗi chung: người gọi cần phân biệt "ứng
    viên không có email" với "hệ thống chưa gửi thư được", vì hai thứ đó cần
    hai hành động khác nhau.
    """
