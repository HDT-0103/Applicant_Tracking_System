"""Unit test nhẹ, KHÔNG cần DB — đủ để pytest có test pass trong CI và kiểm
đúng phần logic auth mà app phụ thuộc (băm mật khẩu + enum role)."""
from modules.auth.infra.password_service import PasswordService
from modules.shared.domain.roles import ALL_ROLES, normalise_role
from modules.shared.domain.supabase_models import RoleType

#: Từ vựng rác còn sót trong bảng `users` của Supabase cũ. KHÔNG phải role của
#: hệ thống này — liệt kê ra để test chứng minh chúng vô hại.
LEGACY_DB_ROLE_VALUES = ("recruiter", "hr_manager", "interviewer", "candidate")


def test_password_hash_roundtrip():
    hashed = PasswordService.hash_password("Secret123")
    assert "$" in hashed  # định dạng salt$key
    assert PasswordService.verify_password("Secret123", hashed) is True
    assert PasswordService.verify_password("wrong-password", hashed) is False


def test_password_hash_is_salted():
    # cùng một mật khẩu phải cho ra hash khác nhau (salt ngẫu nhiên)
    assert PasswordService.hash_password("abc") != PasswordService.hash_password("abc")


def test_verify_bad_format_is_false():
    assert PasswordService.verify_password("x", "khong-dung-dinh-dang") is False


def test_system_has_exactly_three_roles():
    """SmartATS chỉ có 3 role. Không có `candidate`.

    Hai nguồn phải nói cùng một điều: `roles.py` (SSOT của tầng ứng dụng) và
    `supabase_models.RoleType` (model app thật sự dùng khi đọc bảng `users`).
    """
    assert set(ALL_ROLES) == {"admin", "hr", "tech_lead"}
    assert {r.value for r in RoleType} == {"admin", "hr", "tech_lead"}


def test_legacy_roles_are_converted_not_passed_through():
    """Từ vựng cũ trong DB phải quy đổi, không được lọt nguyên trạng."""
    assert normalise_role("recruiter") == "hr"
    assert normalise_role("hr_manager") == "hr"
    assert normalise_role("interviewer") == "tech_lead"


def test_candidate_role_gets_no_access():
    """`candidate` là dữ liệu rác của DB cũ, không phải role của hệ thống.

    Phải trả về None để caller từ chối xác thực, tuyệt đối không fallback sang
    một role có quyền.
    """
    assert normalise_role("candidate") is None
    assert normalise_role("khong-ton-tai") is None
    assert normalise_role(None) is None


def test_no_legacy_db_value_ever_becomes_admin():
    """Rác trong DB không được leo lên quyền quản trị.

    `recruiter`/`hr_manager` quy về `hr`, `interviewer` về `tech_lead`, còn
    `candidate` bị loại thẳng — không giá trị nào chạm tới `admin`.
    """
    for raw in LEGACY_DB_ROLE_VALUES:
        assert normalise_role(raw) != "admin", raw
        assert normalise_role(raw) in ("hr", "tech_lead", None), raw
