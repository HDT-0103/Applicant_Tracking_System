import urllib.parse
import httpx
import structlog
from typing import Optional, Tuple

logger = structlog.get_logger(__name__)

class GoogleOAuthService:
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.auth_url = "https://accounts.google.com/o/oauth2/v2/auth"
        self.token_url = "https://oauth2.googleapis.com/token"

    def get_authorization_url(self) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
            "access_type": "offline",
            "prompt": "consent",  # Force consent to ensure we get a refresh token
        }
        return f"{self.auth_url}?{urllib.parse.urlencode(params)}"

    async def exchange_code(self, code: str) -> Tuple[Optional[str], Optional[str]]:
        """Returns (access_token, refresh_token)"""
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": self.redirect_uri
        }
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(self.token_url, data=data)
                resp.raise_for_status()
                json_resp = resp.json()
                return json_resp.get("access_token"), json_resp.get("refresh_token")
        except Exception as e:
            logger.error("google.oauth.exchange_failed", error=str(e))
            return None, None

    async def refresh_access_token(self, refresh_token: str) -> Optional[str]:
        """Returns new access_token if successful, else None"""
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
        }
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(self.token_url, data=data)
                resp.raise_for_status()
                json_resp = resp.json()
                return json_resp.get("access_token")
        except Exception as e:
            logger.error("google.oauth.refresh_failed", error=str(e))
            return None
