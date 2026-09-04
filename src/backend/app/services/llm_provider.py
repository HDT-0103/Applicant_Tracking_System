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
        self.model = model or os.getenv(
            "HF_MODEL", "Qwen/Qwen2.5-7B-Instruct"
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
    """Use the fallback provider only for an upstream Groq rate limit."""

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
            if not _is_groq_rate_limit(error):
                raise
            logger.warning(
                "Groq Rate Limit exceeded. Switching to Hugging Face Provider (Qwen 7B)..."
            )
            return self.fallback.invoke(
                system_prompt=system_prompt,
                user_input=user_input,
                response_model=response_model,
                temperature=temperature,
            )
