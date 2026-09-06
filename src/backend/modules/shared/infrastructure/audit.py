"""Nhật ký kiểm toán: một chỗ ghi cho mọi module.

## Vì sao

Bảng `audit_logs` có 46 dòng từ tháng 8 rồi im: `AuthService._write_audit_log`
là một hàm `pass` ("tạm thời bỏ qua"), còn chấm hồ sơ, xác nhận lịch, nộp CV,
thao tác admin chưa từng ghi gì. Trang "Nhật ký kiểm toán" ở admin vì thế chỉ
là bảo tàng. Module này là nơi DUY NHẤT insert vào `audit_logs`; route gọi
`await recorder.record(...)` sau khi việc đã xong.

## Nguyên tắc

* Ghi nhật ký không bao giờ làm hỏng request: lỗi được nuốt và log.
* Không bịa nguồn gốc: thiếu IP / user-agent thì để NULL, không điền
  "127.0.0.1" hay "Browser".
* Dưới pytest thì tắt (`PYTEST_CURRENT_TEST`): bộ test chạy với `.env` thật,
  nếu không chặn thì mỗi lần chạy test là vài chục dòng rác vào DB.
"""
from __future__ import annotations

import asyncio
import os
from typing import Annotated, Any, Optional

import structlog
from fastapi import Depends, Request

from modules.shared.infrastructure.config import Settings, get_settings
from modules.shared.infrastructure.supabase_client import get_supabase_client

logger = structlog.get_logger(__name__)

#: Tên hành động — dùng thống nhất để màn hình admin lọc được.
LOGIN_PASSWORD = "login_password"
LOGIN_GOOGLE = "login_google"
REGISTER = "register"
UPLOAD_RESUME = "upload_resume"
REVIEW_SUBMIT = "review_submit"
SLOT_CONFIRM = "slot_confirm"
INTERVIEW_DETAILS_SENT = "interview_details_sent"
ADMIN_USER_UPDATE = "admin_user_update"
ADMIN_SESSION_REVOKE = "admin_session_revoke"
ADMIN_ABAC_UPDATE = "admin_abac_update"
ADMIN_VECTOR_REINDEX = "admin_vector_reindex"
CANDIDATE_SEARCH = "candidate_search"


def client_context(request: Optional[Request]) -> tuple[Optional[str], Optional[str]]:
    """(ip, user_agent) của request, hoặc (None, None) khi không có.

    Backend chạy sau proxy của Azure Container Apps nên `request.client.host`
    là IP của proxy; IP thật nằm ở `X-Forwarded-For` (phần tử đầu).
    """
    if request is None:
        return None, None
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else None)
    ua = request.headers.get("user-agent") or None
    return (ip or None), (ua[:500] if ua else None)


class AuditRecorder:
    def __init__(self, client: Any, enabled: bool = True) -> None:
        self._client = client
        self._enabled = enabled and client is not None

    @property
    def enabled(self) -> bool:
        return self._enabled

    def record_sync(
        self,
        action: str,
        *,
        user_id: Optional[str] = None,
        candidate_uuid: Optional[str] = None,
        ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> bool:
        if not self._enabled:
            return False
        row = {
            "action": action,
            "user_id": user_id,
            "candidate_uuid": candidate_uuid,
            "ip_address": ip,
            "user_agent": user_agent,
            "details": details or {},
        }
        try:
            self._client.table("audit_logs").insert(row).execute()
            return True
        except Exception as exc:  # noqa: BLE001 — nhật ký không được làm hỏng request
            logger.warning("audit.write_failed", action=action, error=str(exc)[:200])
            return False

    async def record(self, action: str, **kwargs: Any) -> bool:
        # Một vòng PostgREST ~160 ms từ Azure: đẩy ra thread, không chặn event loop.
        return await asyncio.to_thread(self.record_sync, action, **kwargs)


def _under_pytest() -> bool:
    return bool(os.environ.get("PYTEST_CURRENT_TEST"))


def get_audit_recorder(settings: Annotated[Settings, Depends(get_settings)]) -> AuditRecorder:
    if _under_pytest():
        return AuditRecorder(client=None, enabled=False)
    return AuditRecorder(client=get_supabase_client(settings, use_admin=True))


AuditDep = Annotated[AuditRecorder, Depends(get_audit_recorder)]
