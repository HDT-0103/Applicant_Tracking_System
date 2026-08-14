from __future__ import annotations

import json
import logging
import re
from typing import Any

from src.backend.app.schemas.resume_analysis import ResumeAnalysis
from src.backend.app.services.llm_provider import LLMProvider

logger = logging.getLogger(__name__)


class LLMService:
    """Service tương tác với LLM để phân tích và trích xuất thông tin cấu trúc từ Resume text."""

    def __init__(self, provider: LLMProvider) -> None:
        self.provider = provider

    def _clean_json_output(self, raw_response: str) -> str:
        """Helper loại bỏ markdown code block (```json ... ```) từ LLM response."""
        cleaned = raw_response.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
            cleaned = re.sub(r"\n?```$", "", cleaned).strip()
        return cleaned

    def analyze_resume(self, resume_text: str) -> ResumeAnalysis:
        """Phân tích resume_text và trả về DTO ResumeAnalysis dạng Pydantic object."""
        prompt = f"""
You are an ATS recruitment assistant expert in parsing CVs.

Analyze the following resume text carefully and extract structured information.

Return ONLY a single valid JSON object matching this schema:
{{
    "summary": "Professional summary of candidate (2-3 concise sentences)",
    "skills": ["Skill 1", "Skill 2"],
    "strengths": ["Strength 1", "Strength 2"],
    "weaknesses": ["Weakness 1", "Weakness 2"],
    "experience": [
        {{
            "company": "Company Name",
            "role": "Job Title",
            "duration": "Dates/Duration",
            "description": "Key responsibilities and achievements"
        }}
    ]
}}

Rules:
- Do NOT include markdown code blocks like ```json or ```.
- Do NOT include any intro, outro, or explanation prose.
- Return ONLY the JSON string.

Resume Text:
{resume_text}
"""
        raw_result = self.provider.generate_text(prompt)
        clean_json_str = self._clean_json_output(raw_result)

        try:
            data = json.loads(clean_json_str)
            return ResumeAnalysis(**data)
        except (json.JSONDecodeError, Exception) as err:
            logger.error(f"Failed to parse LLM response into JSON: {err}\nRaw output: {raw_result}")
            raise ValueError(f"LLM returned invalid JSON structure: {err}") from err