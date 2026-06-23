import os
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# 1. Tìm đường dẫn file .env tự động bằng cách quét ngược lên trên
CURRENT_FILE = Path(__file__).resolve()

def find_env_file(start_path: Path) -> Path:
    for parent in start_path.parents:
        if (parent / ".env").exists() or (parent / ".env.example").exists():
            return parent / ".env"
    return start_path.parents[5] / ".env"

ENV_PATH = find_env_file(CURRENT_FILE)

# 2. Nạp file .env vào biến môi trường hệ thống (Dùng để backup nếu chạy không qua env-cmd)
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH, override=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = Field(default="SmartATS", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    log_level: str = Field(default="info", alias="LOG_LEVEL")
    cors_origins: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")

    # Đọc tự động hoàn toàn từ môi trường hệ thống qua biến alias hoặc lấy mặc định rỗng
    google_client_id: str = Field(default="", alias="GOOGLE_CLIENT_ID")
    google_client_secret: str = Field(default="", alias="GOOGLE_CLIENT_SECRET")
    google_redirect_uri: str = Field(
        default="http://localhost:8000/auth/google/callback",
        alias="GOOGLE_REDIRECT_URI",
    )

    jwt_secret: str = Field(default="change_me_in_local_env", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=60, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=7, alias="REFRESH_TOKEN_EXPIRE_DAYS")

    admin_emails: str = Field(default="", alias="ADMIN_EMAILS")
    recruiter_email_domains: str = Field(default="", alias="RECRUITER_EMAIL_DOMAINS")

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
    # Ưu tiên lấy trực tiếp các biến môi trường hiện tại đang có trong OS do env-cmd nạp vào
    return Settings(**dict(os.environ))