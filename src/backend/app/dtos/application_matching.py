from __future__ import annotations

from pydantic import BaseModel


class ApplicationMatchResult(BaseModel):
    """Kết quả tổng hợp Application Matching đầy đủ cho 1 Candidate x Job Posting."""

    candidate_uuid: str
    job_posting_id: str
    summary_score: float | None = None
    experience_score: float | None = None
    github_score: float | None = None
    overall_score: float | None = None
    github_project: str | None = None
    github_embedding: list[float] | None = None