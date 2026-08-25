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
