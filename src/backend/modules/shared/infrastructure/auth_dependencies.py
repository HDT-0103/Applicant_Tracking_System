from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from modules.auth.domain.models import AuthUser, UserRole
from modules.auth.infra.jwt_service import JwtService
from modules.shared.infrastructure.config import Settings, get_settings

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database.connection import get_db_session
from backend.app.models.user_session import UserSession

_bearer_scheme = HTTPBearer(auto_error=False)


def get_jwt_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> JwtService:
    return JwtService(settings)


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(_bearer_scheme),
    ],
    jwt_service: Annotated[JwtService, Depends(get_jwt_service)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> AuthUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )

    try:
        user = jwt_service.decode_token(
            credentials.credentials,
            expected_type="access",
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    if user.jti:
        stmt = select(UserSession).where(UserSession.token_jti == user.jti)
        session_rec = await db.scalar(stmt)
        if session_rec and session_rec.is_revoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has been revoked by admin",
            )

    return user


def require_roles(*allowed_roles: UserRole):
    def dependency(
        current_user: Annotated[AuthUser, Depends(get_current_user)],
    ) -> AuthUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Role '{current_user.role}' is not permitted for this action"
                ),
            )
        return current_user

    return dependency
