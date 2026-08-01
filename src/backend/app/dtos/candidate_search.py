from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class HardFilterDTO(BaseModel):
    skills: Optional[List[str]] = None
    location: Optional[str] = None
    university: Optional[str] = None
    education_level: Optional[str] = None


class SoftRequirementDTO(BaseModel):
    summary: str = ""
    experience: str = ""


class SearchRequirementDTO(BaseModel):
    hard_filter: Optional[HardFilterDTO] = None
    soft_query: SoftRequirementDTO = Field(default_factory=SoftRequirementDTO)


class ExperienceDTO(BaseModel):
    company: str
    position: str
    duration: str
    highlights: List[str] = Field(default_factory=list)


class CandidateSearchResultDTO(BaseModel):
    candidate_id: str
    score: float
    summary: str = ""
    skills: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    experiences: List[ExperienceDTO] = Field(default_factory=list)
    github_summary: Optional[str] = None
    linkedin_summary: Optional[str] = None