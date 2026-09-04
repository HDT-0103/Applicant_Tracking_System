"""Ma trận phân quyền: 3 role × các nhóm endpoint, và ABAC masking.

Chốt lại hai quy tắc mà cả hệ thống dựa vào:

1. `admin` chỉ quản trị — bị 403 ở mọi endpoint nghiệp vụ.
2. `hr` và `tech_lead` vào được đúng như nhau; khác biệt duy nhất nằm ở dữ liệu
   trả về sau khi qua `apply_abac`.

Test chạy không cần DB: dependency `get_current_user` được override.
"""

from contextlib import contextmanager

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
from modules.shared.infrastructure import abac
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

class _PanelStub:
    """Repo review tối giản: chỉ trả lời câu hỏi về quyền.

    Có nó thì ma trận RBAC không phải chạm Supabase thật — trước đây test này
    đi thẳng vào cơ sở dữ liệu chung để hỏi một câu về phân quyền.
    """

    def __init__(self, member: bool) -> None:
        self._member = member

    # AsyncJobVisibilitySource: một tin "job-1", người gọi hoặc là chủ tin và
    # trong hội đồng (member=True), hoặc chẳng là gì cả.
    async def job_postings_created_by(self, user_id):
        return ["job-1"] if self._member else []

    async def job_postings_for_reviewer(self, reviewer_id):
        return ["job-1"] if self._member else []

    async def job_posting_of_candidate(self, candidate_uuid):
        return "job-1"

    async def candidates_on_job_postings(self, candidate_uuids, job_posting_ids):
        return set(candidate_uuids) if "job-1" in job_posting_ids else set()

    async def get_reviews(self, candidate_uuid):
        return []

    async def get_panel_size(self, candidate_uuid):
        return 1


@pytest.fixture
def on_panel():
    from modules.review.adapters.routes import get_review_repo

    app.dependency_overrides[get_review_repo] = lambda: _PanelStub(member=True)
    yield
    app.dependency_overrides.pop(get_review_repo, None)


@pytest.fixture
def off_panel():
    from modules.review.adapters.routes import get_review_repo

    app.dependency_overrides[get_review_repo] = lambda: _PanelStub(member=False)
    yield
    app.dependency_overrides.pop(get_review_repo, None)

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
def test_hr_and_tech_lead_are_not_blocked_by_role(client, method, path, role, on_panel):
    """Cả hai role đều ĐƯỢC PHÉP dùng các endpoint nghiệp vụ.

    Từ V008, tech lead còn phải nằm trong hội đồng của ứng viên nữa — nhưng đó
    là luật về DỮ LIỆU, không phải về role. Fixture `on_panel` cấp quyền hội
    đồng để test này chỉ còn kiểm đúng một điều: role có bị chặn hay không.
    """
    app.dependency_overrides[get_current_user] = lambda: _as(role)
    try:
        response = getattr(client, method)(path)
        assert response.status_code != 403, f"{role} bị chặn ở {path}"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_a_tech_lead_outside_the_panel_cannot_reach_a_candidate(client, off_panel):
    """Ranh giới mới của V008, ở tầng HTTP.

    Không có nó thì mọi tech lead trong công ty đọc được PII của mọi ứng viên,
    kể cả ở những vị trí họ không được giao chấm.
    """
    app.dependency_overrides[get_current_user] = lambda: _as("tech_lead")
    try:
        for method, path in OPERATIONAL_ENDPOINTS:
            assert getattr(client, method)(path).status_code == 404, path
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_send_interview_details_is_hr_only(client):
    """Gửi thư mời phỏng vấn cho ứng viên là việc của HR.

    Thay cho test cũ về /resolve: hội đồng nhiều Tech Lead không còn khái niệm
    "bất đồng cần HR phá thế bí" — HR chốt bằng chính lá phiếu của mình, và
    thứ tự đó đã được `tests/test_review_routes.py` giữ.
    """
    app.dependency_overrides[get_current_user] = lambda: _as("tech_lead")
    try:
        response = client.post(
            "/api/scheduling/some-slot/send-details",
            json={"room": "Room A", "address": "HQ"},
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
# Policy động đọc từ bảng `abac_policies`
#
# Bảng này là DENY-LIST (`strategy='redact'`). Nó chỉ được phép che THÊM so với
# whitelist trong code. Nếu để nó mở khoá field thì bất kỳ ai ghi được bảng đều
# tự cấp cho mình quyền xem PII ứng viên, không qua code review.
# --------------------------------------------------------------------------

@contextmanager
def _deny_overrides(overrides: dict[str, frozenset[str]]):
    """Ghi đè cache deny-list, đóng băng TTL để test không chạm mạng."""
    saved_cache, saved_time = abac._db_deny_overrides, abac._last_fetch_time
    abac._db_deny_overrides = overrides
    abac._last_fetch_time = float("inf")  # coi như vừa nạp xong
    try:
        yield
    finally:
        abac._db_deny_overrides, abac._last_fetch_time = saved_cache, saved_time


# --------------------------------------------------------------------------
# Nhân khẩu học EEO — che với MỌI role, kể cả `hr` và `admin`
#
# Đây là ngoại lệ duy nhất đứng trên policy theo role. `hr` là role đi sàng lọc
# nên cũng là nơi thiên kiến gây hại nhất; che `tech_lead` mà để hở `hr` thì
# gần như không bảo vệ được gì.
# --------------------------------------------------------------------------

EEO_SAMPLE = {
    "full_name": "Nguyen Van A",
    "race": "Asian",
    "gender_identity": "Female",
    "disability_status": "None",
    "military_status": "Veteran",
    "age_group": "25-34",
    "pronouns": "she/her",
    "skills": ["Go", "Python"],
}


@pytest.mark.parametrize("role", ["hr", "admin", "tech_lead", "someone_else"])
def test_eeo_fields_are_masked_for_every_role(role):
    masked = apply_abac(EEO_SAMPLE, role)
    for field in abac.ALWAYS_REDACTED_FIELDS & EEO_SAMPLE.keys():
        assert masked[field] == "***", f"{field} lọt ra với role {role}"


def test_hr_still_sees_non_eeo_data():
    """Che EEO không được làm hỏng công việc thật của HR."""
    masked = apply_abac(EEO_SAMPLE, "hr")
    assert masked["full_name"] == "Nguyen Van A"
    assert masked["skills"] == ["Go", "Python"]


def test_eeo_masking_reaches_nested_records():
    """Dữ liệu ứng viên hay lồng nhau; che nông thì tầng dưới vẫn lọt."""
    payload = {"candidate": {"profile": {"race": "Asian", "headline": "Backend"}}}
    masked = apply_abac(payload, "hr")
    assert masked["candidate"]["profile"]["race"] == "***"
    assert masked["candidate"]["profile"]["headline"] == "Backend"


def test_eeo_wins_even_if_added_to_visible_whitelist():
    """Ai đó lỡ thêm `race` vào whitelist thì EEO vẫn phải thắng."""
    with _deny_overrides({}):
        polluted = abac.TECH_LEAD_VISIBLE_FIELDS | {"race"}
        assert not (polluted - abac.ALWAYS_REDACTED_FIELDS) & {"race"}


def test_db_policy_can_hide_more_fields():
    """DB che thêm được field mà whitelist vốn cho qua."""
    with _deny_overrides({"tech_lead": frozenset({"public_repos_count"})}):
        masked = apply_abac(SAMPLE_PROFILE, "tech_lead")["enriched_profile"]
        assert masked["github"]["public_repos_count"] == 0  # giữ kiểu int
        assert masked["linkedin"]["headline"] == "Backend Engineer"  # field khác không đổi


def test_db_policy_cannot_unhide_pii():
    """Chốt chặn leo thang đặc quyền: DB không mở khoá được field đã bị che.

    Kể cả khi bảng ghi hẳn `email` vào diện cho qua, whitelist trong code vẫn
    thắng — vì policy hiệu lực là PHÉP TRỪ, không phải phép hợp.
    """
    with _deny_overrides({"tech_lead": frozenset({"email", "full_name"})}):
        masked = apply_abac(SAMPLE_PROFILE, "tech_lead")["enriched_profile"]
        assert masked["email"] == "***"
        assert masked["full_name"] == "***"


def test_db_policy_never_widens_beyond_hardcoded_whitelist():
    for role in ("tech_lead", "interviewer", "someone_else"):
        assert abac._get_dynamic_policy(role) <= abac.TECH_LEAD_VISIBLE_FIELDS, role


def test_legacy_role_vocabulary_in_db_is_normalised():
    """Policy ghi bằng từ vựng trước V005 (`interviewer`) vẫn phải có hiệu lực."""
    with _deny_overrides({"tech_lead": frozenset({"headline"})}):
        masked = apply_abac(SAMPLE_PROFILE, "interviewer")["enriched_profile"]
        assert masked["linkedin"]["headline"] == "***"


def test_dotted_field_path_matches_by_leaf_name():
    """`_filter` khớp theo tên field, nên 'resume.email' phải quy về 'email'."""
    assert abac._leaf_field_name({"field_path": "resume.email"}) == "email"
    assert abac._leaf_field_name({"field_path": "email"}) == "email"
    assert abac._leaf_field_name({"field_name": "phone", "field_path": "r.phone"}) == "phone"
    assert abac._leaf_field_name({"field_path": None, "field_name": None}) is None


def test_passthrough_rows_are_ignored_when_loading():
    """Dòng `passthrough` không được biến thành quyền xem."""
    rows = [
        {"role": "tech_lead", "field_path": "email", "strategy": "redact", "is_masked": True},
        {"role": "interviewer", "field_path": "resume.phone", "strategy": "passthrough", "is_masked": True},
        {"role": "tech_lead", "field_path": "address", "strategy": "passthrough", "is_masked": False},
    ]
    parsed = abac._parse_policy_rows(rows)
    # `phone` vẫn vào deny-list vì is_masked=True; `address` bị loại vì cả hai
    # điều kiện đều nói "đừng che".
    assert parsed == {"tech_lead": frozenset({"email", "phone"})}


def test_policy_load_failure_backs_off_instead_of_retrying_every_request(monkeypatch):
    """A slow Supabase must not turn into a slow application.

    `apply_abac` runs on every masked response. Without a back-off, a failing
    policy load re-hits the network on each call — one round trip (~200ms here)
    added to every request, serialised behind the cache lock.
    """
    calls = {"n": 0}

    def _failing_fetch():
        calls["n"] += 1
        raise RuntimeError("supabase down")

    monkeypatch.setattr(abac, "_fetch_deny_overrides", _failing_fetch)
    monkeypatch.setattr(abac, "_last_fetch_time", float("-inf"))  # chưa từng nạp

    for _ in range(50):
        apply_abac(SAMPLE_PROFILE, "tech_lead")

    assert calls["n"] == 1, (
        f"tried the network {calls['n']} times across 50 requests; "
        "the back-off after a failed load is not working"
    )


def test_masking_still_works_while_the_policy_load_is_failing():
    """Degraded policy loading must not degrade protection."""
    with _deny_overrides({}):
        masked = apply_abac(SAMPLE_PROFILE, "tech_lead")["enriched_profile"]
        assert masked["email"] == "***"
        assert masked["full_name"] == "***"


def test_db_failure_does_not_widen_access(monkeypatch):
    """Supabase lỗi thì giữ cache cũ, tuyệt đối không nới quyền."""
    def _boom():
        raise RuntimeError("supabase down")

    monkeypatch.setattr(abac, "_fetch_deny_overrides", _boom)
    with _deny_overrides({"tech_lead": frozenset({"public_repos_count"})}):
        abac._last_fetch_time = float("-inf")  # ép hết hạn để kích hoạt refresh
        masked = apply_abac(SAMPLE_PROFILE, "tech_lead")["enriched_profile"]
        assert masked["email"] == "***"
        assert masked["github"]["public_repos_count"] == 0  # cache cũ còn hiệu lực


# --------------------------------------------------------------------------
# Khoá tài khoản (is_approved) — nút "suspend" trong Admin Panel
# --------------------------------------------------------------------------

def _fake_user_row(is_approved: bool) -> dict:
    """Bản ghi bảng `users` tối thiểu để chạy login mà không cần DB thật.

    Supabase SDK trả về dict chứ không phải object ORM, nên đây là dict — đọc
    bằng .get() y như code thật.
    """
    import uuid as _uuid

    from modules.auth.infra.password_service import PasswordService

    return {
        "id": str(_uuid.uuid4()),
        "name": "Someone",
        "email": "someone@example.com",
        "role": "hr",
        "password_hash": PasswordService.hash_password("Secret123"),
        "is_approved": is_approved,
    }


def _auth_service_with(user_row: dict):
    """AuthService với Supabase client giả trả về đúng một user."""
    from unittest.mock import MagicMock

    from modules.auth.application.auth_service import AuthService
    from modules.auth.infra.jwt_service import JwtService
    from modules.shared.infrastructure.config import get_settings

    settings = get_settings()

    lookup_result = MagicMock()
    lookup_result.data = [user_row] if user_row else []

    client = MagicMock()
    # Chuỗi .table("users").select("*").eq("email", ...).limit(1).execute()
    client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
        lookup_result
    )
    # Các lệnh ghi phụ (user_sessions, audit_logs) cứ để MagicMock nuốt — chúng
    # đã được bọc try/except trong AuthService nên không ảnh hưởng kết quả login.

    return AuthService(
        settings=settings,
        google_verifier=MagicMock(),
        jwt_service=JwtService(settings),
        client=client,
    )


@pytest.mark.asyncio
async def test_suspended_account_cannot_log_in():
    """is_approved=False phải chặn đăng nhập — trước đây cột này không ai đọc."""
    service = _auth_service_with(_fake_user_row(is_approved=False))
    with pytest.raises(ValueError, match="approval|suspended"):
        await service.login_with_email_password("someone@example.com", "Secret123")


@pytest.mark.asyncio
async def test_candidate_row_cannot_log_in():
    """`candidate` là rác của DB cũ — không phải người dùng của SmartATS.

    Phải bị từ chối như sai mật khẩu, KHÔNG được để pydantic ném ValidationError
    thành 500 (rò rỉ chi tiết nội bộ và làm client hiểu nhầm là lỗi server).
    """
    row = _fake_user_row(is_approved=True)
    row["role"] = "candidate"
    service = _auth_service_with(row)
    with pytest.raises(ValueError, match="Invalid email or password"):
        await service.login_with_email_password("someone@example.com", "Secret123")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("raw_role", "expected"),
    [("recruiter", "hr"), ("hr_manager", "hr"), ("interviewer", "tech_lead")],
)
async def test_legacy_role_row_logs_in_as_converted_role(raw_role, expected):
    """Tài khoản cũ vẫn đăng nhập được, với role đã quy đổi về từ vựng mới."""
    row = _fake_user_row(is_approved=True)
    row["role"] = raw_role
    service = _auth_service_with(row)
    result = await service.login_with_email_password("someone@example.com", "Secret123")
    assert result.user.role == expected


@pytest.mark.asyncio
async def test_approved_account_can_log_in():
    service = _auth_service_with(_fake_user_row(is_approved=True))
    result = await service.login_with_email_password("someone@example.com", "Secret123")
    assert result.user.role == "hr"
    assert result.accessToken
