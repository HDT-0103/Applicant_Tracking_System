from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from modules.auth.domain.models import AuthUser, UserRole
from modules.auth.infra.jwt_service import JwtService
from modules.shared.infrastructure.config import Settings, get_settings

_bearer_scheme = HTTPBearer(auto_error=False)


def get_jwt_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> JwtService:
    return JwtService(settings)


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(_bearer_scheme),
    ],
    jwt_service: Annotated[JwtService, Depends(get_jwt_service)],
) -> AuthUser:
    # Demo mode: accept dummy-access-token for testing
    # Role can be embedded as "dummy-access-token::{role}" for role switching
    if credentials and credentials.scheme.lower() == "bearer" and credentials.credentials.startswith("dummy-access-token"):
        parts = credentials.credentials.split("::", 1)
        demo_role = parts[1] if len(parts) > 1 else "hr"
        if demo_role not in ("hr", "tech_lead", "admin"):
            demo_role = "hr"
        return AuthUser(
            id="demo-12345",
            email="demo@smartats.com",
            name="Demo Recruiter",
            role=demo_role,
        )
    
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )

    try:
        return jwt_service.decode_token(
            credentials.credentials,
            expected_type="access",
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


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
