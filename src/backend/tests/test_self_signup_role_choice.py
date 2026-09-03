"""Người đăng ký công khai chọn được `hr` hoặc `tech_lead` — và KHÔNG gì khác.

Đây là endpoint duy nhất trong hệ thống cho phép người lạ tự đặt role cho
chính mình, nên ranh giới của nó là thứ phải khoá lại bằng test:

* Chọn `tech_lead` phải THẬT SỰ ghi `tech_lead` xuống DB. Ghi nhầm thành `hr`
  là hỏng im lặng theo hướng nguy hiểm nhất: tài khoản đó thấy đầy đủ PII ứng
  viên, đúng thứ ABAC sinh ra để che.
* `admin` phải bị chặn ở CẢ HAI tầng. Nó mở `/api/admin/*`; tự cấp được là mất
  hệ thống. Tầng request chặn bằng kiểu, tầng service chặn lại lần nữa vì
  service còn được gọi từ script và test, không chỉ từ HTTP.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from pydantic import ValidationError

from modules.auth.application.auth_service import AuthService
from modules.auth.domain.models import RegisterRequest
from modules.auth.infra.jwt_service import JwtService
from modules.shared.infrastructure.config import get_settings

PASSWORD = "smoke-password-123"


def _service(inserted_role: str) -> tuple[AuthService, MagicMock]:
    lookup = MagicMock()
    lookup.data = []  # email chưa ai dùng

    inserted = MagicMock()
    inserted.data = [{
        "id": "11111111-1111-1111-1111-111111111111",
        "email": "someone@example.com",
        "name": "Someone",
        "role": inserted_role,
    }]

    client = MagicMock()
    table = client.table.return_value
    table.select.return_value.eq.return_value.limit.return_value.execute.return_value = lookup
    table.insert.return_value.select.return_value.execute.return_value = inserted

    settings = get_settings()
    service = AuthService(
        settings=settings,
        google_verifier=MagicMock(),
        jwt_service=JwtService(settings),
        client=client,
    )
    return service, table


class TestRoleChosenAtSignup:
    @pytest.mark.asyncio
    async def test_choosing_tech_lead_writes_tech_lead_to_the_database(self):
        service, table = _service(inserted_role="tech_lead")

        result = await service.register_user(
            "Someone", "someone@example.com", PASSWORD, role="tech_lead"
        )

        # LẦN insert ĐẦU TIÊN là bảng users. Sau đó service còn ghi session và
        # audit log qua cùng một mock, nên `call_args` (lần cuối) là nhầm chỗ.
        assert table.insert.call_args_list[0][0][0]["role"] == "tech_lead"
        assert result.user.role == "tech_lead"

    @pytest.mark.asyncio
    async def test_saying_nothing_still_creates_an_hr(self):
        """Client cũ chưa gửi trường `role` phải chạy y như trước."""
        service, table = _service(inserted_role="hr")

        result = await service.register_user("Someone", "someone@example.com", PASSWORD)

        assert table.insert.call_args_list[0][0][0]["role"] == "hr"
        assert result.user.role == "hr"

    @pytest.mark.asyncio
    async def test_admin_cannot_be_self_assigned_even_bypassing_http(self):
        service, table = _service(inserted_role="admin")

        with pytest.raises(ValueError):
            await service.register_user(
                "Someone", "someone@example.com", PASSWORD, role="admin"
            )

        # Không được chạm tới bảng users: dừng TRƯỚC khi ghi, không phải dọn sau.
        table.insert.assert_not_called()


class TestRequestBoundary:
    def test_the_request_model_rejects_admin(self):
        with pytest.raises(ValidationError):
            RegisterRequest(
                name="Someone",
                email="someone@example.com",
                password=PASSWORD,
                role="admin",
            )

    def test_the_request_model_defaults_to_hr(self):
        payload = RegisterRequest(
            name="Someone", email="someone@example.com", password=PASSWORD
        )
        assert payload.role == "hr"
