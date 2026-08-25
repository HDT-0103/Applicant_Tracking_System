"""Pytest bootstrap cho toàn repo.

Chạy trước mọi lần import test, lo hai việc:

1. **Nạp `.env`.** `modules.shared.infrastructure.config.Settings` đọc biến môi
   trường ngay lúc import module, nên thiếu biến là hỏng ở khâu *thu thập* test
   chứ không phải lúc chạy — pytest dừng sạch với `ValidationError` và không
   một test nào chạy. Trước đây phải nhớ `set -a; . ./.env; set +a` trước mỗi
   lần gọi pytest; quên là tưởng repo hỏng.

2. **Dựng sys.path.** Trong repo đang tồn tại song song ba tiền tố import
   (`modules.*`, `app.*`, `src.backend.app.*`) do lịch sử merge để lại. Thêm cả
   hai thư mục gốc để mọi tiền tố cùng phân giải được, bất kể pytest được gọi
   từ đâu.
"""
import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent

# --- 1. sys.path -----------------------------------------------------------
# `src`        -> import được `backend.*`
# `src/backend`-> import được `modules.*` và `app.*`
# `_ROOT`      -> import được `src.backend.*`
for _path in (_ROOT, _ROOT / "src", _ROOT / "src" / "backend"):
    _str = str(_path)
    if _str not in sys.path:
        sys.path.insert(0, _str)

# --- 2. .env ---------------------------------------------------------------
# Không ghi đè biến đã có sẵn trong môi trường: CI đặt secret qua env thật, và
# một file .env lập trình viên để quên trên máy không được phép lấn át.
_ENV_FILE = _ROOT / ".env"
if _ENV_FILE.is_file():
    try:
        from dotenv import load_dotenv

        load_dotenv(_ENV_FILE, override=False)
    except ImportError:  # pragma: no cover - python-dotenv nằm trong requirements
        # Bản dự phòng tối giản, đủ cho định dạng KEY=VALUE.
        for _line in _ENV_FILE.read_text(encoding="utf-8").splitlines():
            _line = _line.strip()
            if not _line or _line.startswith("#") or "=" not in _line:
                continue
            _key, _, _value = _line.partition("=")
            os.environ.setdefault(_key.strip(), _value.strip().strip("'\""))
