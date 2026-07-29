from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database.connection import get_db_session
from modules.auth.application.auth_service import AuthService
from modules.auth.domain.models import (
    AuthTokenResponse,
    GoogleLoginRequest,
    RefreshTokenRequest,
    RefreshTokenResponse,
    LoginRequest,
    RegisterRequest,
)
from modules.auth.infra.google_verifier import GoogleTokenVerifier
from modules.auth.infra.jwt_service import JwtService
from modules.shared.infrastructure.config import Settings, get_settings

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def get_auth_service(
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> AuthService:
    return AuthService(
        settings=settings,
        google_verifier=GoogleTokenVerifier(settings),
        jwt_service=JwtService(settings),
        db=db,
    )


@router.post("/google", response_model=AuthTokenResponse)
async def google_login(
    payload: GoogleLoginRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthTokenResponse:
    try:
        return await auth_service.login_with_google(payload.credential)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.error("auth.google.error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google login failed due to a server error",
        ) from exc


@router.post("/login", response_model=AuthTokenResponse)
async def email_password_login(
    payload: LoginRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthTokenResponse:
    try:
        return await auth_service.login_with_email_password(payload.email, payload.password)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.error("auth.login.error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed due to a server error",
        ) from exc


@router.post("/register", response_model=AuthTokenResponse)
async def email_password_register(
    payload: RegisterRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthTokenResponse:
    try:
        return await auth_service.register_user(
            name=payload.name,
            email=payload.email,
            password=payload.password,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.error("auth.register.error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed due to a server error",
        ) from exc


@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_access_token(
    payload: RefreshTokenRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> RefreshTokenResponse:
    try:
        return await auth_service.refresh_tokens(payload.refreshToken)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.error("auth.refresh.error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed due to a server error",
        ) from exc
