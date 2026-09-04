"""Công ty của người dùng (V009) và lần đăng nhập Google đầu tiên.

Hai điều được khoá ở đây:

* Người mới bấm "Sign in with Google" phải CÓ tài khoản sau đó. Nhánh tự tạo
  từng nằm sau một hàm ném lỗi khi chưa có dòng `users`, nên nó chưa bao giờ
  chạy tới — nút này với người mới luôn là 401.
* Công ty không nằm trong token. `/me` đọc từ bảng để frontend biết ai còn
  phải hoàn tất hồ sơ, và `PATCH /me` chỉ đổi được đúng hai cột công ty.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from modules.auth.application.auth_service import AuthService
from modules.auth.domain.models import AuthUser
from modules.auth.infra.jwt_service import JwtService
from modules.shared.infrastructure.config import get_settings

GOOGLE_PROFILE = {
    "email": "new.person@gmail.com",
    "name": "New Person",
    "id": "google-123",
    "picture": None,
}


def _result(rows):
    m = MagicMock()
    m.data = rows
    return m


def _service(*, existing_row: dict | None, inserted_row: dict | None = None, settings=None):
    client = MagicMock()
    table = client.table.return_value
    table.select.return_value.eq.return_value.limit.return_value.execute.return_value = _result(
        [existing_row] if existing_row else []
    )
    table.select.return_value.eq.return_value.eq.return_value.execute.return_value = _result(
        [existing_row] if existing_row else []
    )
    table.insert.return_value.select.return_value.execute.return_value = _result(
        [inserted_row] if inserted_row else []
    )
    table.update.return_value.eq.return_value.execute.return_value = _result(
        [inserted_row or existing_row]
    )

    settings = settings or get_settings()
    service = AuthService(
        settings=settings,
        google_verifier=MagicMock(),
        jwt_service=JwtService(settings),
        client=client,
    )
    service._google_verifier.verify_credential = MagicMock(return_value=GOOGLE_PROFILE)
    return service, table


class TestFirstGoogleLogin:
    @pytest.mark.asyncio
    async def test_a_newcomer_gets_an_hr_account_and_no_company_yet(self):
        inserted = {
            "id": "u-new", "email": GOOGLE_PROFILE["email"], "name": "New Person",
            "role": "hr", "is_approved": True,
        }
        service, table = _service(existing_row=None, inserted_row=inserted)

        result = await service.login_with_google("credential")

        row = table.insert.call_args_list[0][0][0]
        assert row["email"] == GOOGLE_PROFILE["email"]
        assert row["role"] == "hr"
        assert result.user.id == "u-new"
        # Chưa khai công ty: frontend đưa tới /onboarding/company.
        assert result.user.company_name is None

    @pytest.mark.asyncio
    async def test_an_admin_email_becomes_admin(self):
        settings = get_settings().model_copy(update={"admin_emails": GOOGLE_PROFILE["email"]})
        inserted = {"id": "u-adm", "email": GOOGLE_PROFILE["email"], "name": "New", "role": "admin"}
        service, table = _service(existing_row=None, inserted_row=inserted, settings=settings)

        await service.login_with_google("credential")

        assert table.insert.call_args_list[0][0][0]["role"] == "admin"

    @pytest.mark.asyncio
    async def test_a_domain_whitelist_still_keeps_strangers_out(self):
        # RECRUITER_EMAIL_DOMAINS đặt rồi thì chỉ domain trong đó mới tự tạo
        # được tài khoản. Rỗng = không giới hạn (test đầu tiên).
        settings = get_settings().model_copy(update={"recruiter_email_domains": "acme.com"})
        service, table = _service(existing_row=None, settings=settings)

        with pytest.raises(ValueError):
            await service.login_with_google("credential")
        table.insert.assert_not_called()

    @pytest.mark.asyncio
    async def test_an_existing_user_signs_in_with_their_company(self):
        existing = {
            "id": "u-1", "email": GOOGLE_PROFILE["email"], "name": "New Person",
            "role": "tech_lead", "is_approved": True, "is_active": True,
            "company_name": "Acme", "company_website": None,
        }
        service, table = _service(existing_row=existing)

        result = await service.login_with_google("credential")

        # Lần insert duy nhất là bản ghi phiên (user_sessions), không phải users.
        assert all("email" not in c[0][0] for c in table.insert.call_args_list)
        assert result.user.role == "tech_lead"
        assert result.user.company_name == "Acme"


class TestMyProfile:
    def _user(self) -> AuthUser:
        return AuthUser(id="u-1", email="a@b.co", name="A", role="hr")

    @pytest.mark.asyncio
    async def test_me_reads_the_company_from_the_table_not_the_token(self):
        row = {"id": "u-1", "email": "a@b.co", "name": "A", "role": "hr",
               "company_name": "Acme", "company_website": "https://acme.example"}
        service, _ = _service(existing_row=row)

        me = await service.get_me(self._user())

        assert me.company_name == "Acme"
        assert me.company_website == "https://acme.example"

    @pytest.mark.asyncio
    async def test_updating_the_company_touches_only_the_two_company_columns(self):
        row = {"id": "u-1", "email": "a@b.co", "name": "A", "role": "hr",
               "company_name": "Acme", "company_website": None}
        service, table = _service(existing_row=row)

        await service.update_company(self._user(), "  Acme ", "")

        payload = table.update.call_args_list[0][0][0]
        assert payload == {"company_name": "Acme", "company_website": None}
        # Role / email / is_approved là việc của admin, không đi qua đây.
        assert "role" not in payload and "is_approved" not in payload

    @pytest.mark.asyncio
    async def test_settings_can_rename_without_touching_the_company(self):
        row = {"id": "u-1", "email": "a@b.co", "name": "A", "role": "hr", "company_name": "Acme"}
        service, table = _service(existing_row=row)

        await service.update_profile(self._user(), name="  Mai Hương ")

        assert table.update.call_args_list[0][0][0] == {"name": "Mai Hương"}

    @pytest.mark.asyncio
    async def test_me_says_whether_the_account_has_a_password_but_never_the_hash(self):
        row = {"id": "u-1", "email": "a@b.co", "name": "A", "role": "hr", "password_hash": "salt$key"}
        service, _ = _service(existing_row=row)
        me = await service.get_me(self._user())
        assert me.has_password is True
        assert "salt$key" not in me.model_dump_json()

        row_google = {"id": "u-1", "email": "a@b.co", "name": "A", "role": "hr", "password_hash": None}
        service, _ = _service(existing_row=row_google)
        assert (await service.get_me(self._user())).has_password is False


class TestChangePassword:
    def _user(self) -> AuthUser:
        return AuthUser(id="u-1", email="a@b.co", name="A", role="hr")

    def _row(self, password: str | None) -> dict:
        from modules.auth.infra.password_service import PasswordService
        return {"id": "u-1", "password_hash": PasswordService.hash_password(password) if password else None}

    @pytest.mark.asyncio
    async def test_the_current_password_must_be_right(self):
        service, table = _service(existing_row=self._row("old-secret"))
        with pytest.raises(ValueError, match="incorrect"):
            await service.change_password(self._user(), "wrong", "new-secret-1")
        table.update.assert_not_called()

    @pytest.mark.asyncio
    async def test_a_correct_current_password_writes_a_new_hash(self):
        from modules.auth.infra.password_service import PasswordService
        service, table = _service(existing_row=self._row("old-secret"))

        await service.change_password(self._user(), "old-secret", "new-secret-1")

        payload = table.update.call_args_list[0][0][0]
        assert set(payload) == {"password_hash"}
        assert payload["password_hash"] != "new-secret-1"  # đã băm, không lưu thô
        assert PasswordService.verify_password("new-secret-1", payload["password_hash"])

    @pytest.mark.asyncio
    async def test_a_google_account_has_nothing_to_change(self):
        # Tạo mật khẩu cho tài khoản Google là mở thêm một cửa đăng nhập mà
        # chủ tài khoản không ngờ tới.
        service, table = _service(existing_row=self._row(None))
        with pytest.raises(ValueError, match="Google"):
            await service.change_password(self._user(), "x", "new-secret-1")
        table.update.assert_not_called()
