from __future__ import annotations

import json
import logging
import os
from abc import ABC, abstractmethod
from typing import Any

from dotenv import load_dotenv
from groq import Groq
from groq import RateLimitError
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Báo cáo lượt dùng (token) cho trang admin.
#
# Provider không biết ai đang gọi và để làm gì; route đặt hai ContextVar dưới
# đây trước khi gọi (ContextVar đi theo cả `asyncio.to_thread`). Sink do
# `apps/main.py` gắn qua `set_usage_sink`; không có sink thì im lặng.
# ---------------------------------------------------------------------------
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Callable, Iterator, Optional

llm_operation: ContextVar[str] = ContextVar("llm_operation", default="chat")
llm_user_id: ContextVar[Optional[str]] = ContextVar("llm_user_id", default=None)
_usage_sink: Optional[Callable[[dict], None]] = None


def set_usage_sink(sink: Optional[Callable[[dict], None]]) -> None:
    global _usage_sink
    _usage_sink = sink


@contextmanager
def llm_context(operation: str, user_id: Optional[str] = None) -> Iterator[None]:
    """Đặt thao tác / người dùng cho mọi lượt LLM bên trong khối."""
    t1 = llm_operation.set(operation)
    t2 = llm_user_id.set(user_id)
    try:
        yield
    finally:
        llm_operation.reset(t1)
        llm_user_id.reset(t2)


def report_usage(model: str, usage: Any, provider: str = "") -> None:
    """Gửi số token của một response tới sink. Không bao giờ ném lỗi."""
    if _usage_sink is None or usage is None:
        return
    try:
        get = usage.get if isinstance(usage, dict) else (lambda k: getattr(usage, k, None))
        payload = {
            "provider": provider,
            "model": model,
            "prompt_tokens": int(get("prompt_tokens") or get("prompt_token_count") or 0),
            "completion_tokens": int(get("completion_tokens") or get("candidates_token_count") or 0),
            "total_tokens": int(get("total_tokens") or get("total_token_count") or 0),
            "operation": llm_operation.get(),
            "user_id": llm_user_id.get(),
        }
        _usage_sink(payload)
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM usage report failed: %s", str(exc)[:200])


class LLMProvider(ABC):
    """
    Base abstraction for every LLM provider.

    If response_model is provided:
        -> return a validated Pydantic object.

    Otherwise:
        -> return plain string.
    """

    @abstractmethod
    def invoke(
        self,
        system_prompt: str,
        user_input: Any,
        response_model: type[BaseModel] | None = None,
        temperature: float = 0.1,
    ) -> Any:
        pass

    def generate_text(
        self,
        prompt: str,
        temperature: float = 0.1,
    ) -> str:
        """Compatibility helper for services that only need plain text."""
        result = self.invoke(
            system_prompt="You are a helpful assistant.",
            user_input=prompt,
            temperature=temperature,
        )
        if not isinstance(result, str):
            raise TypeError("LLM provider returned a non-text response")
        return result


class GroqProvider(LLMProvider):

    def __init__(
        self,
        model: str = "openai/gpt-oss-20b",
    ):
        self.client = Groq(
            api_key=os.getenv("GROQ_API_KEY")
        )

        self.model = model

    def invoke(
        self,
        system_prompt: str,
        user_input: Any,
        response_model: type[BaseModel] | None = None,
        temperature: float = 0.1,
    ) -> Any:
        """
        Invoke Groq model.

        Parameters
        ----------
        system_prompt:
            Instruction for the model.

        user_input:
            String or Pydantic model.

        response_model:
            If provided, the model will be forced to return JSON
            matching this schema and the response will be validated
            into the given Pydantic model.

        temperature:
            LLM temperature.
        """

        # ----------------------------
        # Serialize user input
        # ----------------------------
        if isinstance(user_input, BaseModel):
            user_content = user_input.model_dump_json(
                indent=2
            )
        else:
            user_content = str(user_input)

        # ----------------------------
        # Structured Output
        # ----------------------------
        if response_model is not None:

            schema = response_model.model_json_schema()
            schema_text = json.dumps(schema, ensure_ascii=False, indent=2)

            system_prompt = (
                f"{system_prompt}\n\n"
                "Return ONLY a valid JSON object.\n"
                "Do NOT explain.\n"
                "Do NOT wrap in markdown.\n"
                "The JSON MUST follow this schema:\n"
                f"{schema_text}"
            )

        # ----------------------------
        # Build request
        # ----------------------------
        request_kwargs = {}

        if response_model is not None:
            request_kwargs["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": response_model.__name__,
                    "schema": schema,
                },
            }

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_content,
                },
            ],
            temperature=temperature,
            **request_kwargs,
        )

        content = response.choices[0].message.content
        report_usage(self.model, getattr(response, "usage", None), provider="groq")

        # ----------------------------
        # Plain Text
        # ----------------------------
        if response_model is None:
            return content

        # ----------------------------
        # Structured Output
        # ----------------------------
        return response_model.model_validate_json(content)


class HFProvider(LLMProvider):
    """Hugging Face Router provider using its OpenAI-compatible endpoint."""

    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
    ):
        self._api_key = api_key or os.getenv("HF_API_KEY")
        self._client: OpenAI | None = None
        # Qwen2.5-7B trên router bị chuyển sang provider Together đòi endpoint
        # riêng (400 "non-serverless model"). 72B được phục vụ serverless.
        self.model = model or os.getenv(
            "HF_MODEL", "Qwen/Qwen2.5-72B-Instruct"
        )

    @property
    def client(self) -> OpenAI:
        if self._client is None:
            self._client = OpenAI(
                api_key=self._api_key,
                base_url="https://router.huggingface.co/v1",
            )
        return self._client

    def invoke(
        self,
        system_prompt: str,
        user_input: Any,
        response_model: type[BaseModel] | None = None,
        temperature: float = 0.1,
    ) -> Any:
        if isinstance(user_input, BaseModel):
            user_content = user_input.model_dump_json(indent=2)
        else:
            user_content = str(user_input)

        request_prompt = system_prompt
        request_kwargs: dict[str, Any] = {}
        if response_model is not None:
            schema = response_model.model_json_schema()
            request_prompt = (
                f"{system_prompt}\n\n"
                "Return ONLY a valid JSON object. Do NOT use markdown. "
                "The JSON MUST follow this schema:\n"
                f"{json.dumps(schema, ensure_ascii=False, indent=2)}"
            )
            request_kwargs["response_format"] = {"type": "json_object"}

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": request_prompt},
                {"role": "user", "content": user_content},
            ],
            temperature=temperature,
            **request_kwargs,
        )
        content = response.choices[0].message.content or ""
        report_usage(self.model, getattr(response, "usage", None), provider="huggingface")
        if response_model is None:
            return content
        return response_model.model_validate_json(content)


HF_Provider = HFProvider


def _is_groq_rate_limit(error: Exception) -> bool:
    if isinstance(error, RateLimitError):
        return True
    if getattr(error, "status_code", None) == 429:
        return True
    if getattr(error, "code", None) == "rate_limit_exceeded":
        return True
    response = getattr(error, "response", None)
    return getattr(response, "status_code", None) == 429


class FallbackLLMProvider(LLMProvider):
    """Gọi provider chính; hỏng vì BẤT KỲ lý do nào thì sang provider dự phòng.

    Trước đây chỉ rate limit (429) mới sang dự phòng. Key Groq hết hạn (401)
    hay model bị gỡ (400) thì lỗi rơi thẳng ra chatbot dưới dạng "AI service
    is not configured" — trong khi Hugging Face đã cấu hình sẵn và chạy được.
    Lý do hỏng của provider chính được ghi log; chỉ khi dự phòng cũng hỏng
    mới ném lỗi (của dự phòng, kèm lỗi chính trong chuỗi `from`).
    """

    def __init__(self, primary: LLMProvider, fallback: LLMProvider):
        self.primary = primary
        self.fallback = fallback

    def invoke(
        self,
        system_prompt: str,
        user_input: Any,
        response_model: type[BaseModel] | None = None,
        temperature: float = 0.1,
    ) -> Any:
        try:
            return self.primary.invoke(
                system_prompt=system_prompt,
                user_input=user_input,
                response_model=response_model,
                temperature=temperature,
            )
        except Exception as error:
            reason = "rate limit" if _is_groq_rate_limit(error) else f"{type(error).__name__}: {str(error)[:200]}"
            logger.warning(
                "Primary LLM provider failed (%s). Switching to fallback provider %s.",
                reason,
                getattr(self.fallback, "model", type(self.fallback).__name__),
            )
            try:
                return self.fallback.invoke(
                    system_prompt=system_prompt,
                    user_input=user_input,
                    response_model=response_model,
                    temperature=temperature,
                )
            except Exception as fallback_error:
                logger.error(
                    "Fallback LLM provider failed too: %s: %s",
                    type(fallback_error).__name__,
                    str(fallback_error)[:200],
                )
                raise fallback_error from error


class LLMNotConfiguredError(RuntimeError):
    """Không có provider nào dựng được: thiếu cả GROQ_API_KEY lẫn HF_API_KEY."""


def build_default_llm_provider() -> LLMProvider:
    """Groq chính, Hugging Face dự phòng — nhưng KHÔNG sập khi thiếu một key.

    `GroqProvider()` ném GroqError ngay lúc khởi tạo nếu thiếu `GROQ_API_KEY`,
    tức là trước khi `FallbackLLMProvider` có cơ hội chuyển sang HF. Một môi
    trường chỉ cấu hình HF (CI, máy dev mới) vì thế mất luôn chatbot lẫn
    pipeline CV dù HF đang chạy được. Ở đây chỉ dựng provider có key; có cả
    hai thì mới ghép fallback.
    """
    providers: list[LLMProvider] = []
    if os.getenv("GROQ_API_KEY"):
        providers.append(GroqProvider())
    if os.getenv("HF_API_KEY"):
        providers.append(HFProvider())
    if not providers:
        raise LLMNotConfiguredError(
            "No LLM provider configured: set GROQ_API_KEY and/or HF_API_KEY."
        )
    if len(providers) == 1:
        return providers[0]
    return FallbackLLMProvider(primary=providers[0], fallback=providers[1])
