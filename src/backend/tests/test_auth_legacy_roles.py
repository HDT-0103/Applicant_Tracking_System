"""Legacy role values in the `users` table must not break sign-in.

`AuthUser.role` is a Literal of the three canonical roles. Handing it a value
straight from the table raises a pydantic ValidationError, which reaches the
caller as a 500:

    1 validation error for AuthUser role
    Input should be 'admin', 'hr' or 'tech_lead'
    [type=literal_error, input_value='recruiter', input_type=str]

The table still holds pre-V005 vocabulary, and Postgres cannot drop values from
an enum, so those rows are not going away. Every sign-in path has to convert
them. There are three, and each one had to be fixed separately — hence this
file covering all of them together.
"""
from __future__ import annotations

import uuid as _uuid
from unittest.mock import MagicMock

import pytest

from modules.auth.application.auth_service import AuthService
from modules.auth.infra.jwt_service import JwtService
from modules.auth.infra.password_service import PasswordService
from modules.shared.infrastructure.config import get_settings

PASSWORD = "Secret123"


def _row(role: str, *, with_password: bool = True) -> dict:
    row = {
        "id": str(_uuid.uuid4()),
        "name": "Someone",
        "email": "someone@example.com",
        "role": role,
        "is_approved": True,
        "is_active": True,
    }
    if with_password:
        row["password_hash"] = PasswordService.hash_password(PASSWORD)
    return row


def _service(row: dict | None) -> AuthService:
    """AuthService whose every table read returns `row`."""
    result = MagicMock()
    result.data = [row] if row else []

    client = MagicMock()
    table = client.table.return_value
    # The sign-in paths chain .eq().limit() and .eq().eq() in different orders.
    table.select.return_value.eq.return_value.limit.return_value.execute.return_value = result
    table.select.return_value.eq.return_value.eq.return_value.execute.return_value = result
    table.insert.return_value.select.return_value.execute.return_value = result

    settings = get_settings()
    return AuthService(
        settings=settings,
        google_verifier=MagicMock(),
        jwt_service=JwtService(settings),
        client=client,
    )


LEGACY_TO_CANONICAL = [
    ("recruiter", "hr"),
    ("hr_manager", "hr"),
    ("interviewer", "tech_lead"),
]


class TestEmailPasswordSignIn:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(("stored", "expected"), LEGACY_TO_CANONICAL)
    async def test_legacy_role_converts(self, stored, expected):
        service = _service(_row(stored))
        result = await service.login_with_email_password(
            "someone@example.com", PASSWORD
        )
        assert result.user.role == expected

    @pytest.mark.asyncio
    async def test_candidate_is_refused_not_crashed(self):
        service = _service(_row("candidate"))
        with pytest.raises(ValueError, match="Invalid email or password"):
            await service.login_with_email_password("someone@example.com", PASSWORD)


class TestGoogleSignIn:
    """The path that produced the reported error.

    `resolve_role_from_supabase` converted the value correctly, but its result
    was discarded whenever the user row existed, so the raw value went straight
    into AuthUser.
    """

    @pytest.mark.asyncio
    @pytest.mark.parametrize(("stored", "expected"), LEGACY_TO_CANONICAL)
    async def test_legacy_role_converts(self, stored, expected):
        service = _service(_row(stored, with_password=False))
        service._google_verifier.verify_credential = MagicMock(
            return_value={
                "email": "someone@example.com",
                "name": "Someone",
                "id": "google-1",
                "picture": None,
            }
        )

        result = await service.login_with_google("fake-credential")
        assert result.user.role == expected

    @pytest.mark.asyncio
    async def test_unknown_role_is_refused_not_crashed(self):
        service = _service(_row("candidate", with_password=False))
        service._google_verifier.verify_credential = MagicMock(
            return_value={
                "email": "someone@example.com",
                "name": "Someone",
                "id": "google-1",
                "picture": None,
            }
        )

        with pytest.raises(ValueError):
            await service.login_with_google("fake-credential")


class TestRegistration:
    @pytest.mark.asyncio
    async def test_public_signup_always_lands_on_hr(self):
        # Defence rather than a fix: the insert sets the role explicitly, but a
        # trigger rewriting it would otherwise turn signup into a 500.
        #
        # The lookup and the insert need SEPARATE result objects: registration
        # first checks "is this email taken?", and sharing one mock makes that
        # check see the row the insert is about to return.
        lookup = MagicMock()
        lookup.data = []          # email not taken
        inserted = MagicMock()
        inserted.data = [_row("recruiter")]  # trigger rewrote the role

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

        result = await service.register_user("Someone", "someone@example.com", PASSWORD)
        assert result.user.role == "hr"
