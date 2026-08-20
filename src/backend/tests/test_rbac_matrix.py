"""Ma trận phân quyền: 3 role × các nhóm endpoint, và ABAC masking.

Chốt lại hai quy tắc mà cả hệ thống dựa vào:

1. `admin` chỉ quản trị — bị 403 ở mọi endpoint nghiệp vụ.
2. `hr` và `tech_lead` vào được đúng như nhau; khác biệt duy nhất nằm ở dữ liệu
   trả về sau khi qua `apply_abac`.

Test chạy không cần DB: dependency `get_current_user` được override.
"""

import pytest
from fastapi.testclient import TestClient

from apps.main import app
from modules.auth.domain.models import AuthUser
from modules.shared.domain.roles import (
    ALL_ROLES,
    OPERATIONAL_ROLES,
    is_operational,
    normalise_role,
)
from modules.shared.infrastructure.abac import apply_abac
from modules.shared.infrastructure.auth_dependencies import get_current_user


@pytest.fixture
def client():
    return TestClient(app)


def _as(role: str) -> AuthUser:
    return AuthUser(id=f"{role}-1", name=role, email=f"{role}@example.com", role=role)


# --------------------------------------------------------------------------
# Từ vựng role
# --------------------------------------------------------------------------

def test_only_three_roles_exist():
    assert set(ALL_ROLES) == {"admin", "hr", "tech_lead"}
    assert set(OPERATIONAL_ROLES) == {"hr", "tech_lead"}


@pytest.mark.parametrize(
    "legacy,expected",
    [
        ("recruiter", "hr"),
        ("hr_manager", "hr"),
        ("HR_Manager", "hr"),
        ("interviewer", "tech_lead"),
        ("hr", "hr"),
        ("admin", "admin"),
    ],
)
def test_legacy_roles_are_normalised(legacy, expected):
    assert normalise_role(legacy) == expected


@pytest.mark.parametrize("unknown", ["candidate", "", None, "root"])
def test_unknown_roles_are_rejected_not_guessed(unknown):
    assert normalise_role(unknown) is None
    assert is_operational(unknown) is False


def test_admin_is_not_operational():
    assert is_operational("admin") is False


# --------------------------------------------------------------------------
# Token cũ (phát hành trước khi hợp nhất role)
# --------------------------------------------------------------------------

def _decode(payload_role):
    """Ký một access token với role tuỳ ý rồi giải mã lại."""
    import jwt as pyjwt

    from modules.auth.infra.jwt_service import JwtService
    from modules.shared.infrastructure.config import get_settings

    settings = get_settings()
    token = pyjwt.encode(
        {
            "sub": "u-1",
            "email": "u@example.com",
            "name": "U",
            "role": payload_role,
            "type": "access",
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    return JwtService(settings).decode_token(token, expected_type="access")


def test_legacy_token_role_is_converted_not_rejected():
    """Token 'recruiter' chưa hết hạn vẫn dùng được, dưới danh nghĩa hr."""
    assert _decode("recruiter").role == "hr"
    assert _decode("interviewer").role == "tech_lead"


@pytest.mark.parametrize("bad", [None, "", "candidate", "superuser"])
def test_token_without_valid_role_is_rejected(bad):
    """Token thiếu role hoặc mang role lạ không được mặc định thành role có quyền."""
    with pytest.raises(ValueError):
        _decode(bad)


# --------------------------------------------------------------------------
# Ma trận endpoint
# --------------------------------------------------------------------------

#: (method, path) của các endpoint nghiệp vụ đại diện cho từng module.
OPERATIONAL_ENDPOINTS = [
    ("get", "/api/enrichment/some-uuid"),
    ("get", "/api/review/some-uuid"),
]


@pytest.mark.parametrize("method,path", OPERATIONAL_ENDPOINTS)
def test_admin_is_blocked_from_business_endpoints(client, method, path):
    app.dependency_overrides[get_current_user] = lambda: _as("admin")
    try:
        response = getattr(client, method)(path)
        assert response.status_code == 403, path
        assert "not permitted" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.parametrize("method,path", OPERATIONAL_ENDPOINTS)
@pytest.mark.parametrize("role", ["hr", "tech_lead"])
def test_hr_and_tech_lead_reach_the_same_endpoints(client, method, path, role):
    app.dependency_overrides[get_current_user] = lambda: _as(role)
    try:
        response = getattr(client, method)(path)
        # Điều cần khẳng định là KHÔNG bị chặn vì role (403).
        assert response.status_code != 403, f"{role} bị chặn ở {path}"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_resolve_conflict_is_hr_only(client):
    """Chốt final call khi HR và Tech Lead bất đồng là đặc quyền của HR."""
    app.dependency_overrides[get_current_user] = lambda: _as("tech_lead")
    try:
        response = client.post(
            "/api/review/some-uuid/resolve", json={"final_decision": "approved"}
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_admin_endpoints_reject_operational_roles(client):
    for role in OPERATIONAL_ROLES:
        app.dependency_overrides[get_current_user] = lambda r=role: _as(r)
        try:
            assert client.get("/api/admin/users").status_code == 403
        finally:
            app.dependency_overrides.pop(get_current_user, None)


# --------------------------------------------------------------------------
# ABAC — khác biệt DUY NHẤT giữa hr và tech_lead
# --------------------------------------------------------------------------

SAMPLE_PROFILE = {
    "candidate_uuid": "abc-123",
    "enriched_profile": {
        "full_name": "Nguyen Van A",
        "email": "a@example.com",
        "phone": "0900000000",
        "address": "HCMC",
        "salary_expectation": "2000 USD",
        "github_username": "nva",
        "analytics": {
            "match_confidence_score": 91.5,
            "semantic_tags": ["golang"],
            "technical_skill_matrix": {
                "pre_enrichment": [1.0],
                "post_enrichment": [2.0],
            },
        },
        "github": {
            "public_repos_count": 12,
            "top_languages": {"Go": 0.7, "Python": 0.3},
        },
        "linkedin": {
            "full_name": "Nguyen Van A",
            "avatar_url": "https://img.example/a.png",
            "headline": "Backend Engineer",
            "experiences": [
                {"title": "BE Dev", "company": "X Corp", "start_date": "2020"}
            ],
        },
    },
}


def test_hr_sees_everything_untouched():
    assert apply_abac(SAMPLE_PROFILE, "hr") == SAMPLE_PROFILE


def test_tech_lead_pii_is_masked():
    masked = apply_abac(SAMPLE_PROFILE, "tech_lead")["enriched_profile"]
    for field in ("full_name", "email", "phone", "address", "salary_expectation"):
        assert masked[field] == "***", field
    assert masked["linkedin"]["full_name"] == "***"
    assert masked["linkedin"]["avatar_url"] == "***"


def test_tech_lead_still_sees_technical_data():
    masked = apply_abac(SAMPLE_PROFILE, "tech_lead")["enriched_profile"]
    assert masked["analytics"]["match_confidence_score"] == 91.5
    assert masked["analytics"]["semantic_tags"] == ["golang"]
    assert masked["analytics"]["technical_skill_matrix"]["post_enrichment"] == [2.0]
    assert masked["github"]["public_repos_count"] == 12
    assert masked["linkedin"]["headline"] == "Backend Engineer"
    assert masked["linkedin"]["experiences"][0]["company"] == "X Corp"


def test_top_languages_is_data_not_schema():
    """`top_languages` có key do dữ liệu sinh ra — không được lọc theo key."""
    masked = apply_abac(SAMPLE_PROFILE, "tech_lead")["enriched_profile"]
    assert masked["github"]["top_languages"] == {"Go": 0.7, "Python": 0.3}


def test_abac_does_not_mutate_the_source():
    """Bản ghi gốc nằm trong store dùng chung — che tại chỗ sẽ xoá dữ liệu của HR."""
    apply_abac(SAMPLE_PROFILE, "tech_lead")
    assert SAMPLE_PROFILE["enriched_profile"]["full_name"] == "Nguyen Van A"


def test_new_unknown_field_is_masked_by_default():
    """Policy là default-deny: field PII thêm sau này tự động bị che."""
    payload = {"date_of_birth": "1998-01-01", "analytics": {"match_confidence_score": 5.0}}
    masked = apply_abac(payload, "tech_lead")
    assert masked["date_of_birth"] == "***"
    assert masked["analytics"]["match_confidence_score"] == 5.0


def test_masking_preserves_types():
    """Che phải giữ kiểu, nếu không response_model của pydantic sẽ 500."""
    payload = {"secret_score": 9.5, "secret_flag": True, "secret_list": [1, 2]}
    masked = apply_abac(payload, "tech_lead")
    assert masked == {"secret_score": 0, "secret_flag": False, "secret_list": []}


def test_unknown_role_is_masked_like_tech_lead():
    """Fail closed: role lạ nhận policy che nhiều nhất."""
    masked = apply_abac(SAMPLE_PROFILE, "someone_else")
    assert masked["enriched_profile"]["email"] == "***"


# --------------------------------------------------------------------------
# Khoá tài khoản (is_approved) — nút "suspend" trong Admin Panel
# --------------------------------------------------------------------------

class _FakeUser:
    """Bản ghi users tối thiểu để chạy login mà không cần DB thật."""

    def __init__(self, is_approved: bool):
        import uuid as _uuid

        from app.models.enums import RoleType

        self.id = _uuid.uuid4()
        self.name = "Someone"
        self.email = "someone@example.com"
        self.role = RoleType.HR
        self.password_hash = None
        self.is_approved = is_approved


def _auth_service_with(db_user):
    """AuthService với DB giả trả về đúng một user."""
    from unittest.mock import AsyncMock, MagicMock

    from modules.auth.application.auth_service import AuthService
    from modules.auth.infra.jwt_service import JwtService
    from modules.auth.infra.password_service import PasswordService
    from modules.shared.infrastructure.config import get_settings

    settings = get_settings()
    db_user.password_hash = PasswordService.hash_password("Secret123")

    db = MagicMock()
    db.scalar = AsyncMock(return_value=db_user)
    db.add = MagicMock()
    db.commit = AsyncMock()

    return AuthService(
        settings=settings,
        google_verifier=MagicMock(),
        jwt_service=JwtService(settings),
        db=db,
    )


@pytest.mark.asyncio
async def test_suspended_account_cannot_log_in():
    """is_approved=False phải chặn đăng nhập — trước đây cột này không ai đọc."""
    service = _auth_service_with(_FakeUser(is_approved=False))
    with pytest.raises(ValueError, match="approval|suspended"):
        await service.login_with_email_password("someone@example.com", "Secret123")


@pytest.mark.asyncio
async def test_approved_account_can_log_in():
    service = _auth_service_with(_FakeUser(is_approved=True))
    result = await service.login_with_email_password("someone@example.com", "Secret123")
    assert result.user.role == "hr"
    assert result.accessToken
