from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from modules.auth.application.auth_service import AuthService
from modules.auth.domain.models import (
    AuthTokenResponse,
    AuthUser,
    ChangePasswordRequest,
    GoogleLoginRequest,
    ProfileUpdateRequest,
    LoginRequest,
    RefreshTokenRequest,
    RefreshTokenResponse,
    RegisterRequest,
)
from modules.auth.infra.google_verifier import GoogleTokenVerifier
from modules.auth.infra.jwt_service import JwtService
from modules.shared.infrastructure.auth_dependencies import get_current_user
from modules.shared.infrastructure.config import Settings, get_settings
from modules.shared.infrastructure.rate_limit import (
    login_rate_limit,
    register_rate_limit,
)
from modules.shared.infrastructure.supabase_client import get_supabase_admin_client

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def get_auth_service(
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[Client, Depends(get_supabase_admin_client)],
) -> AuthService:
    return AuthService(
        settings=settings,
        google_verifier=GoogleTokenVerifier(settings),
        jwt_service=JwtService(settings),
        client=client,
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


@router.post(
    "/login",
    response_model=AuthTokenResponse,
    dependencies=[Depends(login_rate_limit)],
)
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


@router.post(
    "/register",
    response_model=AuthTokenResponse,
    dependencies=[Depends(register_rate_limit)],
)
async def email_password_register(
    payload: RegisterRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> AuthTokenResponse:
    try:
        return await auth_service.register_user(
            name=payload.name,
            email=payload.email,
            password=payload.password,
            role=payload.role,
            company_name=payload.company_name,
            company_website=payload.company_website,
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


@router.get("/me", response_model=AuthUser)
async def read_me(
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    current_user: Annotated[AuthUser, Depends(get_current_user)],
) -> AuthUser:
    """Hồ sơ của người đang đăng nhập, đọc từ DB (token không mang công ty)."""
    try:
        return await auth_service.get_me(current_user)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")


@router.patch("/me", response_model=AuthUser)
async def update_my_profile(
    payload: ProfileUpdateRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    current_user: Annotated[AuthUser, Depends(get_current_user)],
) -> AuthUser:
    """Sửa hồ sơ của chính mình: tên, công ty, website (Settings / onboarding).

    Role, email, is_approved KHÔNG đi qua đây — đó là việc của admin.
    """
    try:
        return await auth_service.update_profile(
            current_user,
            name=payload.name,
            company_name=payload.company_name,
            company_website=payload.company_website,
        )
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_my_password(
    payload: ChangePasswordRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    current_user: Annotated[AuthUser, Depends(get_current_user)],
) -> None:
    """Đổi mật khẩu; phải gửi kèm mật khẩu hiện tại. Tài khoản Google bị từ chối."""
    try:
        await auth_service.change_password(
            current_user, payload.current_password, payload.new_password
        )
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


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