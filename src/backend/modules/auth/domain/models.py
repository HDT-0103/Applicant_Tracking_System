from pydantic import BaseModel, EmailStr, Field

# Nguồn sự thật duy nhất về role: modules.shared.domain.roles.
# Re-export để code cũ `from modules.auth.domain.models import UserRole` vẫn chạy.
from modules.shared.domain.roles import UserRole  # noqa: F401


class AuthUser(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: UserRole
    picture: str | None = None
    jti: str | None = None



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
    # Public registration only. Role is NOT client-selectable: every self-service
    # signup becomes an `hr`. Admin và tech_lead chỉ được cấp qua seed hoặc
    # Admin Dashboard (Epic 6), không bao giờ qua endpoint này.
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6)
