from pydantic import BaseModel, EmailStr, Field

# Nguồn sự thật duy nhất về role: modules.shared.domain.roles.
# Re-export để code cũ `from modules.auth.domain.models import UserRole` vẫn chạy.
from modules.shared.domain.roles import SelfSignupRole, UserRole  # noqa: F401


class AuthUser(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: UserRole
    picture: str | None = None
    jti: str | None = None
    # Công ty của người dùng (V009). KHÔNG nằm trong JWT — token chỉ mang danh
    # tính và role; công ty đọc từ bảng `users` lúc đăng nhập và qua /me.
    # `None` = chưa khai: frontend đưa người đó tới /onboarding/company.
    company_name: str | None = None
    company_website: str | None = None



class GoogleLoginRequest(BaseModel):
    credential: str = Field(min_length=10)


class RefreshTokenRequest(BaseModel):
    refreshToken: str = Field(min_length=10)


class AuthTokenResponse(BaseModel):
    accessToken: str
    refreshToken: str
    user: AuthUser


class RefreshTokenResponse(BaseModel):
    accessToken: str
    refreshToken: str


class TokenClaims(BaseModel):
    sub: str
    email: str
    name: str
    role: UserRole
    token_type: str = Field(alias="type")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class RegisterRequest(BaseModel):
    # Public registration. Người đăng ký chọn được GIỮA HAI role nghiệp vụ —
    # `hr` hoặc `tech_lead` — và không gì khác.
    #
    # `admin` KHÔNG nằm trong `SelfSignupRole`, nên gửi "admin" lên bị pydantic
    # trả 422 ngay ở biên, không đi vào tới service. Đó là chỗ chặn quan trọng
    # nhất của thay đổi này: admin mở `/api/admin/*`, tự cấp được là mất hệ
    # thống. Quyền admin chỉ đến từ seed hoặc Admin Dashboard (Epic 6).
    #
    # Mặc định `hr` để các client cũ chưa gửi trường này vẫn chạy đúng như
    # trước.
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6)
    role: SelfSignupRole = "hr"
    # Bắt buộc từ V009: tài khoản nội bộ phải thuộc về một công ty. Website
    # thì tuỳ chọn.
    company_name: str = Field(min_length=2, max_length=200)
    company_website: str | None = Field(default=None, max_length=500)


class CompanyUpdateRequest(BaseModel):
    """Hoàn tất / sửa thông tin công ty (PATCH /api/auth/me)."""

    company_name: str = Field(min_length=2, max_length=200)
    company_website: str | None = Field(default=None, max_length=500)
