"""Giới hạn tần suất cho những endpoint công khai.

PHẠM VI — đọc trước khi tin vào nó:

Bộ đếm nằm TRONG TIẾN TRÌNH. Chạy nhiều worker hay nhiều replica thì mỗi tiến
trình có hạn mức riêng, nên hạn mức thật bằng cấu hình nhân số tiến trình. Đây
là lớp phòng thủ trước kịch bản một kẻ dò mật khẩu bằng vòng lặp, KHÔNG phải
trước một cuộc tấn công phân tán — thứ đó cần Redis hoặc chặn ở tầng gateway.

Chọn cách này thay vì thêm phụ thuộc (slowapi/redis) vì hệ thống hiện chạy một
tiến trình, và một hàng rào có thật hôm nay đáng giá hơn một hàng rào hoàn hảo
chưa dựng. Khi nào lên nhiều replica thì thay phần lưu trữ ở đây, chữ ký của
`RateLimit` giữ nguyên.
"""

import threading
import time
from collections import deque
from dataclasses import dataclass

import structlog
from fastapi import HTTPException, Request, status

logger = structlog.get_logger(__name__)


def client_key(request: Request) -> str:
    """Định danh người gọi.

    Ưu tiên `X-Forwarded-For` vì sau reverse proxy thì `request.client.host`
    luôn là IP của proxy — tức là MỌI người dùng dùng chung một hạn mức, và
    người thứ hai đăng nhập trong ngày sẽ bị chặn.

    Header này do client gửi nên giả mạo được; ở đây chấp nhận, vì kẻ giả mạo
    chỉ tự đổi được ô đếm của chính mình chứ không chặn được người khác.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@dataclass(frozen=True)
class _Window:
    limit: int
    seconds: int


class RateLimit:
    """Dependency của FastAPI: cho phép *limit* lượt gọi mỗi *seconds* giây.

    Dùng cửa sổ TRƯỢT (giữ mốc thời gian từng lượt) chứ không phải cửa sổ cố
    định. Cửa sổ cố định cho phép gấp đôi hạn mức ngay chỗ giao nhau: 5 lượt ở
    cuối phút này cộng 5 lượt ở đầu phút sau là 10 lượt trong vài giây.
    """

    def __init__(self, name: str, limit: int, seconds: int) -> None:
        self._name = name
        self._window = _Window(limit=limit, seconds=seconds)
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def __call__(self, request: Request) -> None:
        key = client_key(request)
        now = time.monotonic()
        cutoff = now - self._window.seconds

        with self._lock:
            hits = self._hits.setdefault(key, deque())
            while hits and hits[0] <= cutoff:
                hits.popleft()

            if len(hits) >= self._window.limit:
                retry_after = max(1, int(hits[0] + self._window.seconds - now) + 1)
                # Dọn các ô đã nguội hẳn, nếu không thì mỗi IP từng ghé qua sẽ
                # ở lại trong bộ nhớ đến hết đời tiến trình.
                self._evict_idle(cutoff)
                logger.warning("rate_limit.blocked", endpoint=self._name, client=key)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many attempts. Please wait and try again.",
                    headers={"Retry-After": str(retry_after)},
                )

            hits.append(now)

    def _evict_idle(self, cutoff: float) -> None:
        stale = [k for k, v in self._hits.items() if not v or v[-1] <= cutoff]
        for k in stale:
            self._hits.pop(k, None)

    def reset(self) -> None:
        """Xoá sạch bộ đếm. Dành cho test — mỗi test cần một bàn cờ trắng."""
        with self._lock:
            self._hits.clear()


#: Dò mật khẩu. 10 lượt / 5 phút cho mỗi IP: người gõ nhầm vài lần vẫn thoải
#: mái, còn vòng lặp dò từ điển thì dừng ngay ở lượt thứ mười một.
login_rate_limit = RateLimit("auth.login", limit=10, seconds=300)

#: Tạo tài khoản. Chặt hơn vì đăng ký thành công là có ngay quyền vào hệ thống.
register_rate_limit = RateLimit("auth.register", limit=5, seconds=3600)

#: Nộp CV công khai — mỗi lượt là một file tới 10MB đi vào Azure và một lượt
#: gọi LLM. Không giới hạn thì một script biến nó thành hoá đơn.
ingest_rate_limit = RateLimit("ingestion.ingest", limit=20, seconds=3600)

agent_rate_limit = RateLimit("agents.chat", limit=20, seconds=600)
