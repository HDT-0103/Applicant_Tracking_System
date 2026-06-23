import os
from google.auth.transport import requests
from google.oauth2 import id_token

from modules.shared.infrastructure.config import Settings


class GoogleTokenVerifier:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def verify_credential(self, credential: str) -> dict[str, str]:
        # Tự động lấy Client ID từ môi trường hệ thống OS, nếu trống thì fallback về object settings
        client_id = os.getenv("GOOGLE_CLIENT_ID") or self._settings.google_client_id

        # Kiểm tra tính hợp lệ của cấu hình
        if not client_id:
            raise ValueError("GOOGLE_CLIENT_ID is not configured on the server")

        try:
            id_info = id_token.verify_oauth2_token(
                credential,
                requests.Request(),
                client_id,
            )
        except ValueError as exc:
            raise ValueError("Invalid Google credential") from exc

        email = id_info.get("email")
        if not email:
            raise ValueError("Google account does not expose an email address")

        if id_info.get("email_verified") is False:
            raise ValueError("Google email address is not verified")

        return {
            "id": str(id_info["sub"]),
            "email": str(email),
            "name": str(id_info.get("name") or email),
            "picture": id_info.get("picture"),
        }