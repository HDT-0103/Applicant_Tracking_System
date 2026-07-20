from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

import json
import os

from dotenv import load_dotenv
from groq import Groq
from pydantic import BaseModel

load_dotenv()


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


class GroqProvider(LLMProvider):

    def __init__(
        self,
        model: str = "qwen/qwen3-32b",
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

            schema = json.dumps(
                response_model.model_json_schema(),
                ensure_ascii=False,
                indent=2,
            )

            system_prompt = (
                f"{system_prompt}\n\n"
                "Return ONLY a valid JSON object.\n"
                "Do NOT explain.\n"
                "Do NOT wrap in markdown.\n"
                "The JSON MUST follow this schema:\n"
                f"{schema}"
            )

        # ----------------------------
        # Build request
        # ----------------------------
        request_kwargs = {}

        if response_model is not None:
            request_kwargs["response_format"] = {
                "type": "json_object"
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