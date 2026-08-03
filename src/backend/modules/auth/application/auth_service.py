import uuid
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from backend.app.models.audit_log import AuditLog
from backend.app.models.enums import RoleType
from backend.app.models.user import User
from backend.app.models.user_session import UserSession
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
from modules.shared.infrastructure.supabase_client import get_supabase_client

logger = structlog.get_logger(__name__)

# --- Public self-service registration policy -------------------------------
# Ai đăng ký qua form công khai đều là `hr` và dùng được ngay.
# Muốn bật lại luồng "chờ Admin duyệt" (§4.2): đổi PUBLIC_SIGNUP_AUTO_APPROVED = False,
# lúc đó Admin Dashboard (Epic 6) sẽ set is_approved=TRUE để kích hoạt tài khoản.
PUBLIC_SIGNUP_ROLE: UserRole = "hr"
PUBLIC_SIGNUP_AUTO_APPROVED: bool = True


class AuthService:
    def __init__(
        self,
        settings: Settings,
        google_verifier: GoogleTokenVerifier,
        jwt_service: JwtService,
        db: AsyncSession | None = None,
    ) -> None:
        self._settings = settings
        self._google_verifier = google_verifier
        self._jwt_service = jwt_service
        self._supabase_client = get_supabase_client(settings, use_admin=True)
        self._use_supabase = self._supabase_client is not None
        self.db = db

    def resolve_role_from_supabase(self, email: str) -> UserRole:
        """
        Resolve user role by querying Supabase public.users table.

        Role đọc từ Supabase được quy đổi về 1 trong 3 role chuẩn
        (admin / hr / tech_lead) qua ``normalise_role`` — bảng Supabase còn dữ
        liệu cũ dùng ``hr_manager``, ``recruiter``, ``interviewer``.

        Args:
            email: User email from Google OAuth

        Returns:
            UserRole if user exists and is active

        Raises:
            ValueError: If authentication fails
        """
        try:
            # Query Supabase for user by email
            result = self._supabase_client.table('users').select('*').eq(
                'email', email
            ).eq('is_active', True).execute()

            if not result.data or len(result.data) == 0:
                raise ValueError("Authentication failed. Invalid credentials or user not allowed.")

            user_data = result.data[0]
            role = normalise_role(user_data.get('role'))

            if not role:
                # Role rỗng hoặc là giá trị không nhận diện được (vd 'candidate').
                # Không fallback sang role có quyền — từ chối đăng nhập.
                raise ValueError("Authentication failed. Invalid credentials or user not allowed.")

            return role

        except ValueError:
            raise
        except Exception as e:
            logger.error("auth.supabase_query_failed", email=email, error=str(e))
            raise ValueError("Authentication failed due to a database error.")

    def resolve_role(self, email: str) -> UserRole:
        """
        Fallback role resolution using .env configuration.
        Chỉ dùng khi Supabase chưa cấu hình (môi trường dev cục bộ).

        Trước đây hàm này trả về ``interviewer`` cho MỌI email lạ — nghĩa là bất
        kỳ ai có tài khoản Google cũng đăng nhập được. Nay email không nằm trong
        ADMIN_EMAILS hoặc RECRUITER_EMAIL_DOMAINS sẽ bị từ chối: cấp role phải
        là hành động có chủ đích (seed hoặc Admin Dashboard), không phải mặc định.

        Args:
            email: User email

        Returns:
            UserRole based on .env configuration

        Raises:
            ValueError: Nếu email không khớp cấu hình nào.
        """
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
        if not self.db:
            return
        try:
            expires_at = datetime.now(timezone.utc) + timedelta(days=self._settings.refresh_token_expire_days)
            session_rec = UserSession(
                user_id=uuid.UUID(user_id),
                token_jti=jti,
                expires_at=expires_at,
                is_revoked=False
            )
            self.db.add(session_rec)
            await self.db.commit()
        except Exception as e:
            logger.error("auth.session_record.failed", error=str(e))

    async def _write_audit_log(self, user_id: str | None, action: str, details: dict) -> None:
        if not self.db:
            return
        try:
            audit = AuditLog(
                user_id=uuid.UUID(user_id) if user_id else None,
                action=action,
                details=details
            )
            self.db.add(audit)
            await self.db.commit()
        except Exception as e:
            logger.error("auth.audit_log.failed", error=str(e))

    async def login_with_google(self, credential: str, use_supabase: Optional[bool] = None) -> AuthTokenResponse:
        """
        Login with Google OAuth and resolve user role (supporting all active roles)
        """
        profile = self._google_verifier.verify_credential(credential)
        email = profile["email"]

        # Auto-detect if Supabase is configured if use_supabase is not explicitly set
        if use_supabase is None:
            use_supabase = self._use_supabase

        # Use Supabase for role verification if configured and requested
        role_from_supabase = None
        if use_supabase and self._supabase_client:
            try:
                role_from_supabase = self.resolve_role_from_supabase(email)
            except ValueError as e:
                raise ValueError(str(e))

        # Check if user exists in database
        db_user = None
        if self.db:
            stmt = select(User).where(User.email == email)
            db_user = await self.db.scalar(stmt)

            if not db_user:
                # Auto-create user from Google profile. Email đã qua được
                # allowlist của Supabase / .env ở trên — đó chính là bước duyệt,
                # nên tạo thẳng is_approved=True. Nếu để mặc định False thì
                # người dùng vừa tạo sẽ bị chính check bên dưới chặn lại.
                resolved_role = role_from_supabase or self.resolve_role(email)
                db_user = User(
                    name=profile["name"],
                    email=email,
                    role=RoleType(resolved_role),
                    is_approved=True,
                )
                self.db.add(db_user)
                await self.db.commit()
                await self.db.refresh(db_user)
                logger.info("auth.google.auto_register", email=email, role=resolved_role)
            elif not db_user.is_approved:
                self._reject_unapproved(email)

        role = db_user.role.value if db_user else (role_from_supabase or self.resolve_role(email))
        user_id = str(db_user.id) if db_user else profile["id"]

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
            auth_method="supabase" if (use_supabase and self._supabase_client) else "env_fallback"
        )

        return AuthTokenResponse(
            accessToken=access_token,
            refreshToken=refresh_token,
            user=user,
        )

    async def login_with_email_password(self, email: str, password: str) -> AuthTokenResponse:
        if not self.db:
            raise ValueError("Database session not initialized")

        stmt = select(User).where(User.email == email)
        db_user = await self.db.scalar(stmt)

        if not db_user or not db_user.password_hash:
            raise ValueError("Invalid email or password")

        if not PasswordService.verify_password(password, db_user.password_hash):
            raise ValueError("Invalid email or password")

        # Tài khoản bị Admin khoá (is_approved=False) không được đăng nhập.
        # Trước đây cột này không hề được kiểm tra ở bất kỳ luồng login nào, nên
        # nút khoá tài khoản trong Admin Panel chỉ là trang trí.
        if not db_user.is_approved:
            self._reject_unapproved(email)

        user = AuthUser(
            id=str(db_user.id),
            email=db_user.email,
            name=db_user.name,
            role=db_user.role.value,
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
        """Public self-service registration. Always creates an `hr`; role is
        never taken from the client. Admin và tech_lead đến từ seed hoặc Admin
        Dashboard."""
        if not self.db:
            raise ValueError("Database session not initialized")

        # Check if email is already taken
        stmt = select(User).where(User.email == email)
        existing_user = await self.db.scalar(stmt)
        if existing_user:
            raise ValueError("Email already registered")

        # Hash password and create user with the fixed public-signup role.
        password_hash = PasswordService.hash_password(password)
        db_user = User(
            name=name,
            email=email,
            role=RoleType(PUBLIC_SIGNUP_ROLE),
            password_hash=password_hash,
            is_approved=PUBLIC_SIGNUP_AUTO_APPROVED,
        )
        self.db.add(db_user)
        await self.db.commit()
        await self.db.refresh(db_user)

        user = AuthUser(
            id=str(db_user.id),
            email=db_user.email,
            name=db_user.name,
            role=db_user.role.value,
        )

        jti = str(uuid.uuid4())
        access_token = self._jwt_service.create_access_token(user, jti=jti)
        refresh_token = self._jwt_service.create_refresh_token(user, jti=jti)

        await self._create_db_session_record(user.id, jti)
        await self._write_audit_log(
            user.id, "register", {"email": email, "role": user.role}
        )

        logger.info("auth.register.success", user_id=user.id, email=user.email)

        return AuthTokenResponse(
            accessToken=access_token,
            refreshToken=refresh_token,
            user=user,
        )

    async def refresh_tokens(self, refresh_token: str) -> RefreshTokenResponse:
        user = self._jwt_service.decode_token(refresh_token, expected_type="refresh")

        # If session check is enabled, check if the session is revoked
        if self.db and hasattr(user, 'jti') and user.jti:
            stmt = select(UserSession).where(UserSession.token_jti == user.jti)
            session_rec = await self.db.scalar(stmt)
            if session_rec and session_rec.is_revoked:
                raise ValueError("Session revoked")

        # Keep the same JTI or rotate. For simplicity, keep same JTI
        access_token = self._jwt_service.create_access_token(user, jti=getattr(user, 'jti', None))
        new_refresh_token = self._jwt_service.create_refresh_token(user, jti=getattr(user, 'jti', None))

        logger.info("auth.refresh.success", user_id=user.id, email=user.email)

        return RefreshTokenResponse(
            accessToken=access_token,
            refreshToken=new_refresh_token,
        )
