import os
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv  # <--- Sử dụng thư viện dotenv gốc để ép nạp file

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# 1. Tìm chính xác đường dẫn tuyệt đối ra file .env ngoài cùng lớn nhất
CURRENT_FILE = Path(__file__).resolve()
ROOT_DIR = CURRENT_FILE.parents[5]
ENV_PATH = ROOT_DIR / ".env"

# 2. Ép hệ thống nạp trực tiếp file .env ngoài cùng vào bộ nhớ môi trường (os.environ)
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH, override=True)
    print(f"--- [DEBUG] ĐÃ ÉP NẠP FILE .ENV TẠI: {ENV_PATH} ---")
    print(f"--- [DEBUG] CLIENT ID ĐỌC ĐƯỢC: {os.getenv('GOOGLE_CLIENT_ID')} ---")
else:
    print(f"--- [WARNING] KHÔNG TÌM THẤY FILE .ENV TẠI: {ENV_PATH} ---")


class Settings(BaseSettings):
    # Sử dụng cấu hình trống để Pydantic lấy trực tiếp từ os.environ hệ thống
    model_config = SettingsConfigDict(
        extra="ignore",
    )

    app_name: str = Field(default="SmartATS", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    log_level: str = Field(default="info", alias="LOG_LEVEL")
    cors_origins: str = Field(
        default="http://localhost:3000",
        alias="CORS_ORIGINS",
    )

    google_client_id: str = Field(default="", alias="GOOGLE_CLIENT_ID")
    google_client_secret: str = Field(default="", alias="GOOGLE_CLIENT_SECRET")
    google_redirect_uri: str = Field(
        default="http://localhost:8000/auth/google/callback",
        alias="GOOGLE_REDIRECT_URI",
    )

    jwt_secret: str = Field(default="change_me_in_local_env", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=60,
        alias="ACCESS_TOKEN_EXPIRE_MINUTES",
    )
    refresh_token_expire_days: int = Field(
        default=7,
        alias="REFRESH_TOKEN_EXPIRE_DAYS",
    )

    admin_emails: str = Field(default="", alias="ADMIN_EMAILS")
    recruiter_email_domains: str = Field(
        default="",
        alias="RECRUITER_EMAIL_DOMAINS",
    )

    upload_dir: str = Field(default="uploads", alias="UPLOAD_DIR")
    max_upload_mb: int = Field(default=25, alias="MAX_UPLOAD_MB")

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]

    @property
    def admin_email_list(self) -> set[str]:
        return {
            email.strip().lower()
            for email in self.admin_emails.split(",")
            if email.strip()
        }

    @property
    def recruiter_domain_list(self) -> set[str]:
        return {
            domain.strip().lower()
            for domain in self.recruiter_email_domains.split(",")
            if domain.strip()
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()