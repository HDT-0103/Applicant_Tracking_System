from __future__ import annotations

import logging
from typing import Any

from pydantic import  ValidationError
from src.backend.app.dtos.github_project_dto import GitHubProjectDTO
from src.backend.app.repositories.github_profile import GitHubProfileRepository

logger = logging.getLogger(__name__)


class GitHubRetrievalService:
    """Service chịu trách nhiệm retrieval dự án GitHub phù hợp của ứng viên.

    Chỉ tập trung vào Lexical Retrieval & DTO Mapping, tuyệt đối KHÔNG chứa
    logic AI/Embedding/Scoring.
    """

    def __init__(self, repository: GitHubProfileRepository | None = None) -> None:
        self.repository = repository or GitHubProfileRepository()

    async def retrieve_relevant_projects(
        self,
        candidate_uuid: str,
        query: str,
        top_k: int = 3,
    ) -> list[GitHubProjectDTO]:
        """Tìm kiếm các GitHub projects phù hợp với Job Description query.

        Args:
            candidate_uuid: UUID của ứng viên trong hệ thống.
            query: Chuỗi văn bản/từ khóa từ JD (VD: "Python FastAPI PostgreSQL").
            top_k: Số lượng project tối đa cần lấy.

        Returns:
            Danh sách các GitHubProjectDTO đã qua validation.
        """
        # 1. Guard Clause: Kiểm tra input đầu vào
        if not candidate_uuid or not query or not query.strip():
            logger.warning(
                "Empty candidate_uuid or query provided to retrieve_relevant_projects"
            )
            return []

        if top_k <= 0:
            return []

        # 2. Gọi Repository lấy raw dict từ DB/Supabase RPC
        try:
            raw_projects = await self.repository.search_projects_lexically(
                candidate_uuid=candidate_uuid,
                query=query.strip(),
                top_k=top_k,
            )
        except Exception as e:
            logger.error(
                f"Error retrieving GitHub projects for candidate {candidate_uuid}: {e}",
                exc_info=True,
            )
            return []

        if not raw_projects:
            return []

        # 3. Map raw dict -> GitHubProjectDTO với validation từng item
        dtos: list[GitHubProjectDTO] = []
        for raw_item in raw_projects:
            dto = self._map_to_dto(raw_item)
            if dto:
                dtos.append(dto)

        return dtos

    def _map_to_dto(self, raw: dict[str, Any]) -> GitHubProjectDTO | None:
        """Parse và validate raw dict trả về từ Supabase RPC sang GitHubProjectDTO.

        Bao bọc lỗi để 1 project lỗi không làm hỏng cả danh sách trả về.
        """
        if not isinstance(raw, dict):
            logger.warning(f"Invalid raw project type: {type(raw)}. Expected dict.")
            return None

        try:
            # Tên project là bắt buộc
            name = raw.get("name") or raw.get("repo_name")
            if not name:
                logger.warning(f"Skipping project entry due to missing name: {raw}")
                return None

            # Chuẩn hóa topics (Xử lý trường hợp DB trả None hoặc kiểu dữ liệu khác)
            raw_topics = raw.get("topics")
            if isinstance(raw_topics, list):
                cleaned_topics = [str(t) for t in raw_topics if t is not None]
            else:
                cleaned_topics = []

            # Chuẩn hóa lexical_score (Fallbacks nếu RPC đổi tên column score/rank)
            score = raw.get("lexical_score")
            if score is None:
                score = raw.get("score", raw.get("rank", 0.0))

            dto_payload = {
                "name": str(name),
                "language": raw.get("language"),
                "description": raw.get("description"),
                "topics": cleaned_topics,
                "lexical_score": float(score),
            }

            return GitHubProjectDTO(**dto_payload)

        except (ValidationError, TypeError, ValueError) as e:
            logger.warning(
                f"Failed to parse project raw dict to GitHubProjectDTO: {raw}. Error: {e}"
            )
            return None