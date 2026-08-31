from src.backend.app.services.github_evidence import (
    build_github_evidence,
    build_single_project_evidence,
)
from src.backend.app.services.github_retrieval import GitHubProjectDTO


def test_build_single_project_evidence() -> None:
    dto = GitHubProjectDTO(
        name="ai-resume-parser",
        language="Python",
        description="FastAPI service extracting candidate info",
        topics=["fastapi", "pydantic", "openai"],
        lexical_score=0.85,
    )

    evidence = build_single_project_evidence(dto)

    assert "Project Name: ai-resume-parser" in evidence
    assert "Primary Language: Python" in evidence
    assert "Description: FastAPI service extracting candidate info" in evidence
    assert "Topics: fastapi, pydantic, openai" in evidence


def test_build_github_evidence_multiple_projects() -> None:
    dtos = [
        GitHubProjectDTO(name="repo-1", language="Python", lexical_score=0.9),
        GitHubProjectDTO(name="repo-2", language="Go", description="Go microservice", lexical_score=0.8),
    ]

    combined = build_github_evidence(dtos)

    assert "Project Name: repo-1" in combined
    assert "Project Name: repo-2" in combined
    assert "---" in combined


def test_build_github_evidence_empty() -> None:
    assert build_github_evidence([]) == ""