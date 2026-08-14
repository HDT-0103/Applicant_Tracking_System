from typing import Any, List
from src.backend.app.dtos.candidate_search import CandidateSearchResultDTO, ExperienceDTO


class CandidateMapper:
    @staticmethod
    def _parse_experiences(raw_experiences: List[Any]) -> List[ExperienceDTO]:
        exp_dtos: List[ExperienceDTO] = []
        for exp in raw_experiences or []:
            if isinstance(exp, dict):
                company = exp.get("company") or exp.get("company_name") or "N/A"
                position = exp.get("position") or exp.get("title") or "N/A"
                duration = exp.get("duration") or exp.get("period") or "N/A"
                highlights = exp.get("highlights") or exp.get("description") or []
                if isinstance(highlights, str):
                    highlights = [highlights]
            else:
                company = getattr(exp, "company", "N/A")
                position = getattr(exp, "position", "N/A")
                duration = getattr(exp, "duration", "N/A")
                highlights = getattr(exp, "highlights", [])

            exp_dtos.append(
                ExperienceDTO(
                    company=company,
                    position=position,
                    duration=duration,
                    highlights=highlights,
                )
            )
        return exp_dtos

    @classmethod
    def to_search_result_dto(
        cls, profile: Any, score: float
    ) -> CandidateSearchResultDTO:
        raw_experiences = getattr(profile, "experience", []) or []
        experiences = cls._parse_experiences(raw_experiences)

        return CandidateSearchResultDTO(
            candidate_id=str(profile.candidate_uuid),
            score=round(score, 4),
            summary=getattr(profile, "summary", "") or "",
            skills=getattr(profile, "skills", []) or [],
            strengths=getattr(profile, "strengths", []) or [],
            weaknesses=getattr(profile, "weaknesses", []) or [],
            experiences=experiences,
            github_summary=getattr(profile, "github_summary", None),
            linkedin_summary=getattr(profile, "linkedin_summary", None),
        )