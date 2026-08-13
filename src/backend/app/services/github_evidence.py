from __future__ import annotations

from src.backend.app.services.github_retrieval import GitHubProjectDTO


def build_single_project_evidence(project: GitHubProjectDTO) -> str:
    """Chuyển đổi 1 GitHubProjectDTO thành chuỗi văn bản (Evidence Text) chuẩn hóa.

    Ví dụ output:
    Project Name: ai-resume-parser
    Primary Language: Python
    Description: FastAPI service extracting candidate info using LLMs
    Topics: fastapi, pydantic, openai, supabase
    """
    lines = [f"Project Name: {project.name}"]

    if project.language:
        lines.append(f"Primary Language: {project.language}")

    if project.description:
        lines.append(f"Description: {project.description.strip()}")

    if project.topics:
        # Loại bỏ các topic rỗng/None và ghép thành chuỗi phân cách bởi dấu phẩy
        clean_topics = [t.strip() for t in project.topics if t and t.strip()]
        if clean_topics:
            lines.append(f"Topics: {', '.join(clean_topics)}")

    return "\n".join(lines)


def build_github_evidence(projects: list[GitHubProjectDTO]) -> str:
    """Tổng hợp danh sách Top-K GitHubProjectDTO thành một văn bản Evidence hoàn chỉnh

    sẵn sàng đưa vào Embedding Model.Trả về chuỗi rỗng nếu danh sách DTO rỗng.
    """
    if not projects:
        return ""

    evidence_blocks = [
        build_single_project_evidence(project)
        for project in projects
        if project and project.name
    ]

    # Phân cách giữa các project bằng dấu ngắt khối rõ ràng
    return "\n\n---\n\n".join(evidence_blocks)