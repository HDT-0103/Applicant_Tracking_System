"""`.env.example` phải là bản mô tả trung thực của những gì app cần.

Đây là test rẻ nhất trong repo nhưng chặn đúng loại lỗi tốn thời gian nhất:
thêm một biến bắt buộc vào `Settings` mà quên ghi vào `.env.example`. Người
tiếp theo clone repo sẽ gặp `ValidationError` ngay lúc khởi động, không có
manh mối nào chỉ ra biến nào còn thiếu.

Đã xảy ra một lần: `.env` ghi `SUPABASE_SERVICE_KEY` trong khi `Settings` đòi
`SUPABASE_SERVICE_ROLE_KEY`, backend chết ngay khi import.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from modules.shared.infrastructure.config import Settings

_ROOT = Path(__file__).resolve().parent.parent
_ENV_EXAMPLE = _ROOT / ".env.example"


def _documented_keys() -> set[str]:
    if not _ENV_EXAMPLE.is_file():
        pytest.fail(".env.example không tồn tại — người mới không biết cần biến gì")
    text = _ENV_EXAMPLE.read_text(encoding="utf-8")
    return {m.group(1).upper() for m in re.finditer(r"^([A-Za-z_][A-Za-z_0-9]*)=", text, re.M)}


def _required_settings() -> set[str]:
    return {
        name.upper()
        for name, field in Settings.model_fields.items()
        if field.is_required()
    }


def test_every_required_setting_is_documented():
    missing = sorted(_required_settings() - _documented_keys())
    assert not missing, (
        "Biến BẮT BUỘC có trong Settings nhưng thiếu ở .env.example: "
        f"{missing}. Thiếu nó thì backend không khởi động được."
    )


#: Hình dạng của credential thật. Bắt theo dấu hiệu nhận dạng cụ thể thay vì
#: theo độ dài — chuỗi kết nối và danh sách phần mở rộng cũng dài, nhưng chúng
#: là mẫu hợp lệ chứ không phải bí mật.
_SECRET_SHAPES = (
    re.compile(r"^eyJ[A-Za-z0-9_-]{20,}\."),      # JWT (khoá anon/service của Supabase)
    re.compile(r"^sk-[A-Za-z0-9]{20,}"),           # OpenAI
    re.compile(r"^apify_api_[A-Za-z0-9]{20,}"),    # Apify
    re.compile(r"^gh[pousr]_[A-Za-z0-9]{20,}"),    # GitHub token
    re.compile(r"^AIza[A-Za-z0-9_-]{30,}"),        # Google API key
    re.compile(r"^gsk_[A-Za-z0-9]{20,}"),          # Groq
)

#: Có mặt một trong các từ này thì chắc chắn là chỗ điền, không phải giá trị thật.
_PLACEHOLDER_HINTS = ("change_me", "changeme", "your", "example", "<", "xxx", "todo")


def test_env_example_carries_no_real_secret():
    """`.env.example` là mẫu — không được chứa credential thật.

    Vô tình commit khoá thật vào file mẫu là cách rò rỉ phổ biến, và vì file này
    CÓ được git theo dõi (`!.env.example` trong .gitignore) nên không có lưới
    nào đỡ.
    """
    leaked: list[str] = []
    for line in _ENV_EXAMPLE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip().strip("'\"")
        if not value or any(h in value.lower() for h in _PLACEHOLDER_HINTS):
            continue
        if any(shape.match(value) for shape in _SECRET_SHAPES):
            leaked.append(key.strip())

    assert not leaked, (
        f"Có credential thật trong .env.example: {leaked}. "
        "Thay bằng chỗ điền và THU HỒI khoá đã lộ."
    )
