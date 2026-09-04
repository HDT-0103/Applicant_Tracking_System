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
from modules.shared.domain.roles import SELF_SIGNUP_ROLES, normalise_role
from modules.shared.infrastructure.config import Settings

logger = structlog.get_logger(__name__)

#: Role mặc định khi lời gọi không nói gì. Người đăng ký chọn được `hr` hoặc
#: `tech_lead` ở màn hình đăng ký; xem SELF_SIGNUP_ROLES.
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
        """Role cho một tài khoản Google CHƯA có trong bảng `users`.

        `ADMIN_EMAILS` → admin. Còn lại là `hr`, cùng mặc định với đăng ký
        công khai (`PUBLIC_SIGNUP_ROLE`) — đăng ký bằng email đã cho người lạ
        tự tạo tài khoản `hr`, nên chặn riêng đường Google không thêm được lớp
        bảo vệ nào, chỉ làm nút "Sign in with Google" lần đầu luôn báo lỗi.

        `RECRUITER_EMAIL_DOMAINS` là DANH SÁCH TRẮNG khi được đặt: có giá trị
        thì chỉ domain trong đó mới tự tạo được tài khoản; rỗng thì không giới
        hạn. Dữ liệu đã tách theo người tạo, nên tài khoản mới không thấy gì
        của ai cho tới khi tự tạo tin.
        """
        normalized_email = email.strip().lower()
        domain = normalized_email.split("@")[-1]

        if normalized_email in self._settings.admin_email_list:
            return "admin"

        allowed_domains = self._settings.recruiter_domain_list
        if allowed_domains and domain not in allowed_domains:
            raise ValueError("Authentication failed. Invalid credentials or user not allowed.")

        return PUBLIC_SIGNUP_ROLE

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

        res = self._supabase_client.table("users").select("*").eq("email", email).limit(1).execute()
        db_user = res.data[0] if res.data else None

        role_from_supabase = None
        if db_user:
            # Tài khoản đã có: role lấy từ bảng (đã quy đổi từ vựng cũ), và
            # tài khoản bị khoá thì dừng ở đây.
            role_from_supabase = self.resolve_role_from_supabase(email)
            if not db_user.get("is_approved", True):
                self._reject_unapproved(email)
        else:
            # Lần đăng nhập Google ĐẦU TIÊN: tạo tài khoản.
            #
            # Nhánh này từng nằm SAU `resolve_role_from_supabase`, mà hàm đó
            # ném lỗi khi chưa có dòng `users` — nên nó chưa bao giờ chạy tới,
            # và "Sign in with Google" với người mới luôn là 401. Không có
            # `company_name`: người này sẽ được đưa tới /onboarding/company.
            resolved_role = self.resolve_role(email)
            ins_res = (
                self._supabase_client.table("users")
                .insert({
                    "name": profile["name"],
                    "email": email,
                    "role": resolved_role,
                    "is_approved": PUBLIC_SIGNUP_AUTO_APPROVED,
                })
                .select("*")
                .execute()
            )
            db_user = ins_res.data[0] if ins_res.data else None
            if not db_user:
                raise ValueError("Failed to create user record.")
            logger.info("auth.google.auto_register", email=email, role=resolved_role)

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
            company_name=db_user.get("company_name") if db_user else None,
            company_website=db_user.get("company_website") if db_user else None,
            has_password=bool(db_user.get("password_hash")) if db_user else False,
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
            company_name=db_user.get("company_name"),
            company_website=db_user.get("company_website"),
            has_password=True,
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

    async def register_user(
        self,
        name: str,
        email: str,
        password: str,
        role: UserRole = PUBLIC_SIGNUP_ROLE,
        company_name: Optional[str] = None,
        company_website: Optional[str] = None,
    ) -> AuthTokenResponse:
        # Kiểm lại ở đây dù `RegisterRequest` đã chặn bằng kiểu.
        #
        # Service này còn được gọi từ script và test, không chỉ từ route HTTP.
        # Một lời gọi bỏ qua tầng request mà truyền "admin" sẽ tạo ra quản trị
        # viên im lặng — hỏng theo kiểu không ai nhìn thấy cho tới lúc quá
        # muộn. Thà nổ ngay tại đây.
        if role not in SELF_SIGNUP_ROLES:
            raise ValueError(f"Role '{role}' cannot be chosen at registration")

        res = self._supabase_client.table("users").select("id").eq("email", email).limit(1).execute()
        if res.data:
            raise ValueError("Email already registered")

        password_hash = PasswordService.hash_password(password)
        row = {
            "name": name,
            "email": email,
            "role": role,
            "password_hash": password_hash,
            "is_approved": PUBLIC_SIGNUP_AUTO_APPROVED,
        }
        # Chỉ ghi khi có: `RegisterRequest` bắt buộc `company_name`, nhưng
        # service còn được gọi từ script/seed chưa biết tới V009.
        company_name = (company_name or "").strip() or None
        company_website = (company_website or "").strip() or None
        if company_name:
            row["company_name"] = company_name
        if company_website:
            row["company_website"] = company_website
        ins_res = (
            self._supabase_client.table("users")
            .insert(row)
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
            # The insert above sets the requested role explicitly, so this is
            # defence rather than a fix — but a database trigger or default
            # rewriting the value would otherwise turn signup into a 500.
            role=normalise_role(db_user["role"]) or role,
            company_name=db_user.get("company_name") or company_name,
            company_website=db_user.get("company_website") or company_website,
            has_password=True,
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

    # ── Hồ sơ của chính mình ──────────────────────────────────────────────

    async def get_me(self, user: AuthUser) -> AuthUser:
        """Hồ sơ hiện tại đọc từ bảng `users`, không từ token.

        Token không mang công ty (và không nên: đổi công ty mà phải đăng nhập
        lại là vô lý). Frontend gọi ở lúc khôi phục phiên để biết người này đã
        hoàn tất hồ sơ chưa.
        """
        res = (
            self._supabase_client.table("users")
            .select("id, email, name, role, picture, company_name, company_website, password_hash")
            .eq("id", user.id)
            .limit(1)
            .execute()
        )
        row = res.data[0] if res.data else None
        if not row:
            raise LookupError(user.id)
        return AuthUser(
            id=str(row["id"]),
            email=row["email"],
            name=row.get("name") or user.name,
            role=normalise_role(row.get("role")) or user.role,
            picture=row.get("picture"),
            jti=user.jti,
            company_name=row.get("company_name"),
            company_website=row.get("company_website"),
            # Chỉ CÓ/KHÔNG. Hash không bao giờ rời khỏi service.
            has_password=bool(row.get("password_hash")),
        )

    async def update_profile(
        self,
        user: AuthUser,
        *,
        name: Optional[str] = None,
        company_name: Optional[str] = None,
        company_website: Optional[str] = None,
    ) -> AuthUser:
        """Sửa hồ sơ của CHÍNH MÌNH: tên, công ty, website. Không đổi được gì khác.

        Trường `None` = giữ nguyên. Website gửi chuỗi rỗng = xoá (thành NULL),
        vì "không có website" là một trạng thái hợp lệ cần ghi được.
        """
        payload: dict = {}
        if name is not None:
            payload["name"] = name.strip()
        if company_name is not None:
            payload["company_name"] = company_name.strip()
        if company_website is not None:
            payload["company_website"] = company_website.strip() or None
        if not payload:
            return await self.get_me(user)

        res = (
            self._supabase_client.table("users")
            .update(payload)
            .eq("id", user.id)
            .execute()
        )
        if not res.data:
            raise LookupError(user.id)
        logger.info("auth.profile.updated", user_id=user.id, fields=sorted(payload))
        return await self.get_me(user)

    async def update_company(
        self, user: AuthUser, company_name: str, company_website: Optional[str]
    ) -> AuthUser:
        """Giữ cho chỗ gọi cũ; nay là một trường hợp của update_profile."""
        return await self.update_profile(
            user, company_name=company_name, company_website=company_website or ""
        )

    async def change_password(
        self, user: AuthUser, current_password: str, new_password: str
    ) -> None:
        """Đổi mật khẩu của CHÍNH MÌNH, phải chứng minh biết mật khẩu cũ.

        Tài khoản Google không có `password_hash`: không có gì để đổi, và tạo
        mật khẩu mới ở đây là mở thêm một cửa đăng nhập mà chủ tài khoản không
        ngờ tới — từ chối rõ ràng.
        """
        res = (
            self._supabase_client.table("users")
            .select("id, password_hash")
            .eq("id", user.id)
            .limit(1)
            .execute()
        )
        row = res.data[0] if res.data else None
        if not row:
            raise LookupError(user.id)
        if not row.get("password_hash"):
            raise ValueError("This account signs in with Google and has no password to change.")
        if not PasswordService.verify_password(current_password, row["password_hash"]):
            raise ValueError("Current password is incorrect.")
        if PasswordService.verify_password(new_password, row["password_hash"]):
            raise ValueError("New password must be different from the current one.")

        self._supabase_client.table("users").update(
            {"password_hash": PasswordService.hash_password(new_password)}
        ).eq("id", user.id).execute()
        logger.info("auth.password.changed", user_id=user.id)

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