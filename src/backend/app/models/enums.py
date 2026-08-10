import enum
from sqlalchemy import Enum


class RoleType(str, enum.Enum):
    """Role lưu trong cột ``users.role`` (Postgres enum ``role_type``).

    Chỉ còn 3 giá trị, khớp 1-1 với ``modules.shared.domain.roles.UserRole``.

    Lưu ý về DB: Postgres không hỗ trợ xoá giá trị khỏi một enum type, nên
    ``role_type`` trên DB vẫn còn các giá trị cũ (``recruiter``, ``interviewer``,
    ``candidate``). Chúng chỉ ngừng được dùng ở tầng ứng dụng.
    Migration ``V005__consolidate_roles.sql`` chuyển hết dữ liệu cũ sang 3 giá
    trị dưới đây và PHẢI chạy trước khi deploy bản này, nếu không SQLAlchemy sẽ
    ném ``LookupError`` khi đọc một hàng còn mang role cũ.
    """

    ADMIN = "admin"
    HR = "hr"
    TECH_LEAD = "tech_lead"


class StatusType(str, enum.Enum):
    WAITING = "waiting"
    DONE = "done"
    CANCELED = "canceled"
