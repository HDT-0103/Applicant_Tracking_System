from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from modules.auth.application.auth_service import AuthService
from modules.auth.domain.models import (
    AuthTokenResponse,
    GoogleLoginRequest,
    RefreshTokenRequest,
    RefreshTokenResponse,
)
from modules.auth.infra.google_verifier import GoogleTokenVerifier
from modules.auth.infra.jwt_service import JwtService
from modules.shared.infrastructure.config import Settings, get_settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


def get_auth_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthService:
    return AuthService(
        settings=settings,
        google_verifier=GoogleTokenVerifier(settings),
        jwt_service=JwtService(settings),
    )


@router.post("/google", response_model=AuthTokenResponse)
def google_login(
    payload: GoogleLoginRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthTokenResponse:
    try:
        return auth_service.login_with_google(payload.credential)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


@router.post("/refresh", response_model=RefreshTokenResponse)
def refresh_access_token(
    payload: RefreshTokenRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> RefreshTokenResponse:
    try:
        return auth_service.refresh_tokens(payload.refreshToken)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
