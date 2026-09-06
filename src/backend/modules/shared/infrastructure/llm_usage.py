"""Ghi lượt dùng LLM vào `llm_usage_logs` cho trang "AI & Vector" ở admin.

Bảng này rỗng từ đầu — không provider nào báo về, nên màn hình vẽ "dữ liệu
mẫu". Ở đây gắn một sink vào `app/services/llm_provider.py`: mỗi lượt gọi
Groq / Hugging Face (và Gemini ở ingestion) báo số token, sink ghi xuống DB
trong một thread nền. Thao tác nào đang gọi (`operation_type`) và người dùng
nào (`user_id`) đi theo ContextVar, do route đặt.

Chi phí là ƯỚC TÍNH theo bảng giá công khai trong `PRICE_PER_MILLION`; model
không có trong bảng thì `estimated_cost` để NULL — tổng ở admin khi đó là cận
dưới, không phải con số bịa.
"""
from __future__ import annotations

import os
import threading
from typing import Any, Optional

import structlog

from modules.shared.infrastructure.config import Settings
from modules.shared.infrastructure.supabase_client import get_supabase_client

logger = structlog.get_logger(__name__)

#: USD cho 1 triệu token (đầu vào, đầu ra). Nguồn: bảng giá công khai của
#: provider tại thời điểm viết; cập nhật tay khi đổi model.
PRICE_PER_MILLION: dict[str, tuple[float, float]] = {
    "openai/gpt-oss-20b": (0.075, 0.30),          # Groq
    "openai/gpt-oss-120b": (0.15, 0.60),          # Groq
    "llama-3.3-70b-versatile": (0.59, 0.79),      # Groq
    "llama-3.1-8b-instant": (0.05, 0.08),         # Groq
    "gemini-2.0-flash": (0.10, 0.40),
    "gemini-1.5-flash": (0.075, 0.30),
    "gemini-2.5-flash": (0.30, 2.50),
}


def estimate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> Optional[float]:
    price = PRICE_PER_MILLION.get(model) or PRICE_PER_MILLION.get(model.split("/")[-1])
    if price is None:
        return None
    return round((prompt_tokens * price[0] + completion_tokens * price[1]) / 1_000_000, 6)


def make_supabase_usage_sink(settings: Settings):
    """Sink ghi xuống Supabase. Trả về callable nhận dict usage."""

    def _write(usage: dict[str, Any]) -> None:
        try:
            client = get_supabase_client(settings, use_admin=True)
            if client is None:
                return
            model = str(usage.get("model") or "unknown")
            prompt = int(usage.get("prompt_tokens") or 0)
            completion = int(usage.get("completion_tokens") or 0)
            client.table("llm_usage_logs").insert({
                "user_id": usage.get("user_id"),
                "model_name": model,
                "prompt_tokens": prompt,
                "completion_tokens": completion,
                "total_tokens": int(usage.get("total_tokens") or (prompt + completion)),
                "estimated_cost": estimate_cost(model, prompt, completion),
                "operation_type": usage.get("operation") or "chat",
            }).execute()
        except Exception as exc:  # noqa: BLE001 — thống kê không được làm hỏng lượt gọi
            logger.warning("llm_usage.write_failed", error=str(exc)[:200])

    def sink(usage: dict[str, Any]) -> None:
        if os.environ.get("PYTEST_CURRENT_TEST"):
            return
        threading.Thread(target=_write, args=(usage,), daemon=True).start()

    return sink
