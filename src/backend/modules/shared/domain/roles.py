"""Single source of truth cho phân quyền SmartATS.

Hệ thống chỉ có ĐÚNG 3 role. Mọi module khác phải import từ đây, không tự
khai báo lại danh sách role (trước đây có 7 nơi khai báo lệch nhau).

    admin      — chỉ quản trị hệ thống (/api/admin/*). KHÔNG được vào nghiệp vụ.
    hr         — vận hành tuyển dụng đầy đủ, thấy toàn bộ dữ liệu ứng viên.
    tech_lead  — vận hành y hệt hr, nhưng PII của ứng viên bị ABAC che (***).

Khác biệt hr ↔ tech_lead nằm DUY NHẤT ở tầng dữ liệu (modules.shared.
infrastructure.abac), không nằm ở route hay ở UI.
"""

from typing import Literal, get_args

UserRole = Literal["admin", "hr", "tech_lead"]

ADMIN_ROLE: UserRole = "admin"

#: Hai role được phép dùng các endpoint nghiệp vụ (ingestion, enrichment,
#: scheduling, review, job posting). `admin` cố ý KHÔNG có mặt ở đây.
OPERATIONAL_ROLES: tuple[UserRole, ...] = ("hr", "tech_lead")

ALL_ROLES: tuple[UserRole, ...] = get_args(UserRole)

#: Từ vựng cũ còn sót lại trong DB / Supabase / JWT chưa hết hạn.
#: Xem migrations/V005__consolidate_roles.sql.
LEGACY_ROLE_ALIASES: dict[str, UserRole] = {
    "recruiter": "hr",
    "hr_manager": "hr",
    "interviewer": "tech_lead",
}


def normalise_role(raw: str | None) -> UserRole | None:
    """Quy đổi một chuỗi role bất kỳ về 1 trong 3 role chuẩn.

    Trả về ``None`` nếu không nhận diện được — caller quyết định là lỗi xác
    thực hay bỏ qua. Không tự ý fallback sang một role có quyền, vì như vậy sẽ
    cấp quyền cho dữ liệu rác.
    """
    if not raw:
        return None
    value = raw.strip().lower()
    if value in ALL_ROLES:
        return value  # type: ignore[return-value]
    return LEGACY_ROLE_ALIASES.get(value)


def is_operational(role: str | None) -> bool:
    """True nếu role được phép dùng các màn hình nghiệp vụ."""
    return normalise_role(role) in OPERATIONAL_ROLES
