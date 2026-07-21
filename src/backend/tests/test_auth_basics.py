"""Unit test nhẹ, KHÔNG cần DB — đủ để pytest có test pass trong CI và kiểm
đúng phần logic auth mà app phụ thuộc (băm mật khẩu + enum role)."""
from modules.auth.infra.password_service import PasswordService
from backend.app.models.enums import RoleType, StatusType


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


def test_role_type_values():
    assert {r.value for r in RoleType} == {"recruiter", "candidate", "admin", "interviewer"}


def test_status_type_values():
    assert {s.value for s in StatusType} == {"waiting", "done", "canceled"}
