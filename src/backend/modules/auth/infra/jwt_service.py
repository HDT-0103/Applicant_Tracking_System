from datetime import datetime, timedelta, timezone

import jwt
from jwt.exceptions import InvalidTokenError

from modules.auth.domain.models import AuthUser, UserRole
from modules.shared.infrastructure.config import Settings


class JwtService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def create_access_token(self, user: AuthUser, jti: str | None = None) -> str:
        expires = datetime.now(timezone.utc) + timedelta(
            minutes=self._settings.access_token_expire_minutes,
        )
        payload = {
            "sub": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "type": "access",
            "exp": expires,
        }
        if jti:
            payload["jti"] = jti
        return jwt.encode(
            payload,
            self._settings.jwt_secret,
            algorithm=self._settings.jwt_algorithm,
        )

    def create_refresh_token(self, user: AuthUser, jti: str | None = None) -> str:
        expires = datetime.now(timezone.utc) + timedelta(
            days=self._settings.refresh_token_expire_days,
        )
        payload = {
            "sub": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "type": "refresh",
            "exp": expires,
        }
        if jti:
            payload["jti"] = jti
        return jwt.encode(
            payload,
            self._settings.jwt_secret,
            algorithm=self._settings.jwt_algorithm,
        )

    def decode_token(self, token: str, *, expected_type: str) -> AuthUser:
        try:
            payload = jwt.decode(
                token,
                self._settings.jwt_secret,
                algorithms=[self._settings.jwt_algorithm],
            )
        except InvalidTokenError as exc:
            raise ValueError("Invalid or expired token") from exc

        token_type = payload.get("type")
        if token_type != expected_type:
            raise ValueError(f"Expected {expected_type} token")

        return AuthUser(
            id=str(payload["sub"]),
            email=str(payload["email"]),
            name=str(payload.get("name") or payload["email"]),
            role=payload.get("role", "interviewer"),
            picture=None,
            jti=payload.get("jti"),
        )
