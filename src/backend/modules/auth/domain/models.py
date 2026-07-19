from typing import Literal

from pydantic import BaseModel, EmailStr, Field

UserRole = Literal["recruiter", "interviewer", "admin", "tech_lead", "hr"]


class AuthUser(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: UserRole
    picture: str | None = None


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
