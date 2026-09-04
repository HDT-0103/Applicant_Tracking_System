"""Provider dự phòng phải gánh MỌI lỗi của provider chính, không chỉ rate limit.

Chatbot production từng báo "AI service is not configured" vì key Groq hết
hạn (401) trong khi Hugging Face đã cấu hình và chạy được — fallback chỉ được
gọi khi 429.
"""
from __future__ import annotations

import pytest

from src.backend.app.services.llm_provider import FallbackLLMProvider, LLMProvider


class _Boom(LLMProvider):
    def __init__(self, error: Exception) -> None:
        self.error = error
        self.calls = 0

    def invoke(self, system_prompt, user_input, response_model=None, temperature=0.1):
        self.calls += 1
        raise self.error


class _Ok(LLMProvider):
    model = "fake/fallback"

    def __init__(self) -> None:
        self.calls = 0

    def invoke(self, system_prompt, user_input, response_model=None, temperature=0.1):
        self.calls += 1
        return "from fallback"


class _AuthError(Exception):
    status_code = 401


class TestFallback:
    def test_an_invalid_primary_key_still_gets_an_answer(self):
        primary, fallback = _Boom(_AuthError("Invalid API Key")), _Ok()
        result = FallbackLLMProvider(primary, fallback).invoke("sys", "hi")
        assert result == "from fallback"
        assert primary.calls == 1 and fallback.calls == 1

    def test_a_rate_limit_still_falls_back(self):
        class _RateLimited(Exception):
            status_code = 429

        assert FallbackLLMProvider(_Boom(_RateLimited()), _Ok()).invoke("sys", "hi") == "from fallback"

    def test_when_both_fail_the_fallback_error_surfaces_with_the_primary_attached(self):
        primary_err, fallback_err = _AuthError("Invalid API Key"), RuntimeError("HF down")
        with pytest.raises(RuntimeError) as exc:
            FallbackLLMProvider(_Boom(primary_err), _Boom(fallback_err)).invoke("sys", "hi")
        assert exc.value is fallback_err
        assert exc.value.__cause__ is primary_err
