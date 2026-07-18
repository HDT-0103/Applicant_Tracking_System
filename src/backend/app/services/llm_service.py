import re

from src.backend.app.services.llm_provider import LLMProvider
from src.backend.app.schemas.resume_analysis import ResumeAnalysis
import json
class LLMService:
    def __init__(self, provider: LLMProvider):
        self.provider = provider

    def analyze_resume(self, resume_text: str) -> ResumeAnalysis:
        prompt = f"""
        You are an ATS recruitment assistant.

        Analyze this resume.

        Return ONLY valid JSON.

        {{
            "summary": "",
            "skills": [],
            "strengths": [],
            "weaknesses": [],
            "experience": []
        }}

        Do not include markdown.
        Do not include explanation.
        Return only the JSON object.

        Resume:
        {resume_text}
        """
        analysis_result = self.provider.generate_text(prompt)
        # Loại bỏ markdown ẩn nếu có
        clean_json_str = analysis_result.strip()
        if clean_json_str.startswith("```"):
            # Xóa đoạn ```json ở đầu và ``` ở cuối
            clean_json_str = re.sub(r"^```[a-zA-Z]*\n?", "", clean_json_str)
            clean_json_str = re.sub(r"\n?```$", "", clean_json_str).strip()
        
        try:
            data = json.loads(clean_json_str)
        except json.JSONDecodeError:
            raise ValueError(
                "LLM returned invalid JSON."
        )
        return ResumeAnalysis(**data)

    def summarize_resume(self, resume_analysis: ResumeAnalysis) -> str:
        return resume_analysis.summary

    def extract_skills(self, resume_analysis: ResumeAnalysis) -> list[str]:
        return resume_analysis.skills

    def extract_experience(self, resume_analysis: ResumeAnalysis) -> list[dict]:
        return resume_analysis.experience
    
    def extract_strengths(self, resume_analysis: ResumeAnalysis) -> list[str]:
        return resume_analysis.strengths
    
    def extract_weaknesses(self, resume_analysis: ResumeAnalysis) -> list[str]:
        return resume_analysis.weaknesses