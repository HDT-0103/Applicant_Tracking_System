# src/backend/app/dtos/github_matching.py
from __future__ import annotations

from pydantic import BaseModel
from src.backend.app.services.github_retrieval import GitHubProjectDTO


class GitHubMatchResult(BaseModel):
    """Kết quả Matching GitHub của ứng viên cho 1 Job Posting."""

    github_score: float | None = None
    best_project: GitHubProjectDTO | None = None
    best_embedding: list[float] | None = None