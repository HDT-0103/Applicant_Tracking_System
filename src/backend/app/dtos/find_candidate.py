from __future__ import annotations

from pydantic import BaseModel, Field


class FindCandidateRequest(BaseModel):
    role_description: str = Field(
        ..., min_length=1, max_length=4000, description="Role requirements in plain text"
    )
    experience_expectations: str | None = Field(
        default=None, max_length=4000, description="Experience requirements text"
    )
    must_have_skills: list[str] = Field(
        default_factory=list, max_length=25, description="Hard filter skill list"
    )
    top_k: int = Field(default=20, ge=1, le=100)


class FindCandidateResult(BaseModel):
    candidate_uuid: str
    overall_score: float
    lexical_score: float
    semantic_score: float
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    summary: str = ""
    skills: list[str] = Field(default_factory=list)
    github_username: str | None = None
    github_url: str | None = None
    linkedin_url: str | None = None