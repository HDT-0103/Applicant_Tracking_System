import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from supabase import Client

from modules.auth.domain.models import (
    AuthTokenResponse,
    AuthUser,
    RefreshTokenResponse,
    UserRole,
)
from modules.auth.infra.google_verifier import GoogleTokenVerifier
from modules.auth.infra.jwt_service import JwtService
from modules.auth.infra.password_service import PasswordService
from modules.shared.domain.roles import normalise_role
from modules.shared.infrastructure.config import Settings

logger = structlog.get_logger(__name__)

PUBLIC_SIGNUP_ROLE: UserRole = "hr"
PUBLIC_SIGNUP_AUTO_APPROVED: bool = True


class AuthService:
    def __init__(
        self,
        settings: Settings,
        google_verifier: GoogleTokenVerifier,
        jwt_service: JwtService,
        client: Client,
    ) -> None:
        self._settings = settings
        self._google_verifier = google_verifier
        self._jwt_service = jwt_service
        self._supabase_client = client

    def resolve_role_from_supabase(self, email: str) -> UserRole:
        try:
            result = (
                self._supabase_client.table("users")
                .select("*")
                .eq("email", email)
                .eq("is_active", True)
                .execute()
            )

            if not result.data:
                raise ValueError("Authentication failed. Invalid credentials or user not allowed.")

            user_data = result.data[0]
            role = normalise_role(user_data.get("role"))

            if not role:
                raise ValueError("Authentication failed. Invalid credentials or user not allowed.")

            return role

        except ValueError:
            raise
        except Exception as e:
            logger.error("auth.supabase_query_failed", email=email, error=str(e))
            raise ValueError("Authentication failed due to a database error.")

    def resolve_role(self, email: str) -> UserRole:
        normalized_email = email.strip().lower()
        domain = normalized_email.split("@")[-1]

        if normalized_email in self._settings.admin_email_list:
            return "admin"

        if domain in self._settings.recruiter_domain_list:
            return "hr"

        raise ValueError("Authentication failed. Invalid credentials or user not allowed.")

    @staticmethod
    def _reject_unapproved(email: str) -> None:
        logger.warning("auth.login.rejected_unapproved", email=email)
        raise ValueError(
            "Your account is awaiting approval or has been suspended. "
            "Please contact an administrator."
        )

    async def _create_db_session_record(self, user_id: str, jti: str) -> None:
        try:
            expires_at = (
                datetime.now(timezone.utc)
                + timedelta(days=self._settings.refresh_token_expire_days)
            ).isoformat()
            
            self._supabase_client.table("user_sessions").insert({
                "user_id": user_id,
                "token_jti": jti,
                "expires_at": expires_at,
                "is_revoked": False,
            }).execute()
        except Exception as e:
            logger.error("auth.session_record.failed", error=str(e))

    async def _write_audit_log(self, user_id: str | None, action: str, details: dict) -> None:
        # Tạm thời bỏ qua ghi log database
        pass

    async def login_with_google(self, credential: str) -> AuthTokenResponse:
        profile = self._google_verifier.verify_credential(credential)
        email = profile["email"]

        role_from_supabase = None
        try:
            role_from_supabase = self.resolve_role_from_supabase(email)
        except ValueError as e:
            raise ValueError(str(e))

        res = self._supabase_client.table("users").select("*").eq("email", email).limit(1).execute()
        db_user = res.data[0] if res.data else None

        if not db_user:
            resolved_role = role_from_supabase or self.resolve_role(email)
            ins_res = (
                self._supabase_client.table("users")
                .insert({
                    "name": profile["name"],
                    "email": email,
                    "role": resolved_role,
                    "is_approved": True,
                })
                .select("*")
                .execute()
            )
            db_user = ins_res.data[0] if ins_res.data else None
            logger.info("auth.google.auto_register", email=email, role=resolved_role)
        elif not db_user.get("is_approved", True):
            self._reject_unapproved(email)

        # Normalise before building AuthUser. `AuthUser.role` is a Literal of the
        # three canonical roles, so handing it a legacy value straight from the
        # table raises a pydantic ValidationError — which surfaces as a 500 on
        # sign-in rather than anything a user can act on.
        #
        # The `users` table still holds pre-V005 vocabulary ('recruiter',
        # 'hr_manager', 'interviewer'). `resolve_role_from_supabase` above
        # already converts it, but its result was discarded whenever the row
        # existed, so the raw value went through untouched.
        raw_role = db_user.get("role") if db_user else None
        role = (
            normalise_role(raw_role)
            or role_from_supabase
            or self.resolve_role(email)
        )
        if role is None:
            # 'candidate', or anything unrecognised: not a user of this system.
            logger.warning(
                "auth.google.rejected_unknown_role", email=email, raw_role=raw_role
            )
            raise ValueError("Authentication failed. Invalid credentials or user not allowed.")

        user_id = str(db_user.get("id")) if db_user else profile["id"]

        user = AuthUser(
            id=user_id,
            email=email,
            name=profile["name"],
            role=role,
            picture=profile.get("picture"),
        )

        jti = str(uuid.uuid4())
        access_token = self._jwt_service.create_access_token(user, jti=jti)
        refresh_token = self._jwt_service.create_refresh_token(user, jti=jti)

        await self._create_db_session_record(user_id, jti)
        await self._write_audit_log(user_id, "login_google", {"email": email, "role": role})

        logger.info(
            "auth.login.success",
            user_id=user.id,
            email=user.email,
            role=user.role,
            auth_method="supabase",
        )

        return AuthTokenResponse(
            accessToken=access_token,
            refreshToken=refresh_token,
            user=user,
        )

    async def login_with_email_password(self, email: str, password: str) -> AuthTokenResponse:
        res = self._supabase_client.table("users").select("*").eq("email", email).limit(1).execute()
        db_user = res.data[0] if res.data else None

        if not db_user or not db_user.get("password_hash"):
            raise ValueError("Invalid email or password")

        if not PasswordService.verify_password(password, db_user["password_hash"]):
            raise ValueError("Invalid email or password")

        if not db_user.get("is_approved", True):
            self._reject_unapproved(email)

        # Bảng `users` của Supabase cũ còn lẫn từ vựng rác ('recruiter',
        # 'interviewer', 'candidate'). Đẩy thẳng vào AuthUser.role — vốn là
        # Literal 3 giá trị — sẽ ném ValidationError và thành 500, thay vì một
        # lượt từ chối đăng nhập bình thường. Quy đổi trước:
        #   recruiter / hr_manager -> hr, interviewer -> tech_lead
        #   candidate / giá trị lạ -> None, tức không phải người dùng của app này.
        role = normalise_role(db_user.get("role"))
        if role is None:
            logger.warning(
                "auth.login.rejected_unknown_role",
                email=email,
                raw_role=db_user.get("role"),
            )
            raise ValueError("Invalid email or password")

        user = AuthUser(
            id=str(db_user["id"]),
            email=db_user["email"],
            name=db_user["name"],
            role=role,
        )

        jti = str(uuid.uuid4())
        access_token = self._jwt_service.create_access_token(user, jti=jti)
        refresh_token = self._jwt_service.create_refresh_token(user, jti=jti)

        await self._create_db_session_record(user.id, jti)
        await self._write_audit_log(user.id, "login_password", {"email": email, "role": user.role})

        logger.info("auth.login_password.success", user_id=user.id, email=user.email)

        return AuthTokenResponse(
            accessToken=access_token,
            refreshToken=refresh_token,
            user=user,
        )

    async def register_user(self, name: str, email: str, password: str) -> AuthTokenResponse:
        res = self._supabase_client.table("users").select("id").eq("email", email).limit(1).execute()
        if res.data:
            raise ValueError("Email already registered")

        password_hash = PasswordService.hash_password(password)
        ins_res = (
            self._supabase_client.table("users")
            .insert({
                "name": name,
                "email": email,
                "role": PUBLIC_SIGNUP_ROLE,
                "password_hash": password_hash,
                "is_approved": PUBLIC_SIGNUP_AUTO_APPROVED,
            })
            .select("*")
            .execute()
        )

        if not ins_res.data:
            raise ValueError("Failed to create user record.")

        db_user = ins_res.data[0]
        user = AuthUser(
            id=str(db_user["id"]),
            email=db_user["email"],
            name=db_user["name"],
            # Normalised for the same reason as the other two sign-in paths.
            # The insert above sets PUBLIC_SIGNUP_ROLE explicitly, so this is
            # defence rather than a fix — but a database trigger or default
            # rewriting the value would otherwise turn signup into a 500.
            role=normalise_role(db_user["role"]) or PUBLIC_SIGNUP_ROLE,
        )

        jti = str(uuid.uuid4())
        access_token = self._jwt_service.create_access_token(user, jti=jti)
        refresh_token = self._jwt_service.create_refresh_token(user, jti=jti)

        await self._create_db_session_record(user.id, jti)
        await self._write_audit_log(user.id, "register", {"email": email, "role": user.role})

        logger.info("auth.register.success", user_id=user.id, email=user.email)

        return AuthTokenResponse(
            accessToken=access_token,
            refreshToken=refresh_token,
            user=user,
        )

    async def refresh_tokens(self, refresh_token: str) -> RefreshTokenResponse:
        user = self._jwt_service.decode_token(refresh_token, expected_type="refresh")

        if hasattr(user, "jti") and user.jti:
            res = (
                self._supabase_client.table("user_sessions")
                .select("is_revoked")
                .eq("token_jti", user.jti)
                .limit(1)
                .execute()
            )
            if res.data and res.data[0].get("is_revoked"):
                raise ValueError("Session revoked")

        access_token = self._jwt_service.create_access_token(user, jti=getattr(user, "jti", None))
        new_refresh_token = self._jwt_service.create_refresh_token(user, jti=getattr(user, "jti", None))

        logger.info("auth.refresh.success", user_id=user.id, email=user.email)

        return RefreshTokenResponse(
            accessToken=access_token,
            refreshToken=new_refresh_token,
        )