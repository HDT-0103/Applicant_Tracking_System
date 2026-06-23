import structlog

from modules.auth.domain.models import (
    AuthTokenResponse,
    AuthUser,
    RefreshTokenResponse,
    UserRole,
)
from modules.auth.infra.google_verifier import GoogleTokenVerifier
from modules.auth.infra.jwt_service import JwtService
from modules.shared.infrastructure.config import Settings

logger = structlog.get_logger(__name__)


class AuthService:
    def __init__(
        self,
        settings: Settings,
        google_verifier: GoogleTokenVerifier,
        jwt_service: JwtService,
    ) -> None:
        self._settings = settings
        self._google_verifier = google_verifier
        self._jwt_service = jwt_service

    def resolve_role(self, email: str) -> UserRole:
        normalized_email = email.strip().lower()
        domain = normalized_email.split("@")[-1]

        if normalized_email in self._settings.admin_email_list:
            return "admin"

        if domain in self._settings.recruiter_domain_list:
            return "recruiter"

        return "interviewer"

    def login_with_google(self, credential: str) -> AuthTokenResponse:
        profile = self._google_verifier.verify_credential(credential)
        role = self.resolve_role(profile["email"])

        user = AuthUser(
            id=profile["id"],
            email=profile["email"],
            name=profile["name"],
            role=role,
            picture=profile.get("picture"),
        )

        access_token = self._jwt_service.create_access_token(user)
        refresh_token = self._jwt_service.create_refresh_token(user)

        logger.info(
            "auth.login.success",
            user_id=user.id,
            email=user.email,
            role=user.role,
        )

        return AuthTokenResponse(
            accessToken=access_token,
            refreshToken=refresh_token,
            user=user,
        )

    def refresh_tokens(self, refresh_token: str) -> RefreshTokenResponse:
        user = self._jwt_service.decode_token(refresh_token, expected_type="refresh")

        access_token = self._jwt_service.create_access_token(user)
        new_refresh_token = self._jwt_service.create_refresh_token(user)

        logger.info("auth.refresh.success", user_id=user.id, email=user.email)

        return RefreshTokenResponse(
            accessToken=access_token,
            refreshToken=new_refresh_token,
        )
