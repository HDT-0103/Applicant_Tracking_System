from unittest.mock import AsyncMock, MagicMock
import pytest

from src.backend.app.services.github_matching import (
    GitHubMatchingService,
    GitHubMatchResult,
)
from src.backend.app.services.github_retrieval import GitHubProjectDTO


@pytest.fixture
def mock_retrieval_service() -> AsyncMock:
    service = AsyncMock()
    service.retrieve_relevant_projects = AsyncMock()
    return service


@pytest.fixture
def mock_embedding_client() -> AsyncMock:
    client = AsyncMock()
    # Mock trả về vector cố định
    client.embed = AsyncMock()
    return client


class TestGitHubMatchingService:

    @pytest.mark.asyncio
    async def test_match_candidate_github_best_project_selection(
        self, mock_retrieval_service: AsyncMock, mock_embedding_client: AsyncMock
    ) -> None:
        """Test chọn đúng project có điểm Cosine Similarity cao nhất."""
        # Arrange
        proj_1 = GitHubProjectDTO(name="p1", language="Python", lexical_score=0.9)
        proj_2 = GitHubProjectDTO(name="p2", language="Go", lexical_score=0.8)
        mock_retrieval_service.retrieve_relevant_projects.return_value = [proj_1, proj_2]

        job_vector = [1.0, 0.0]

        # project 1 embedding: [0.8, 0.6] -> sim = 0.8
        # project 2 embedding: [1.0, 0.0] -> sim = 1.0 (Best match)
        mock_embedding_client.embed.side_effect = [
            [0.8, 0.6],
            [1.0, 0.0],
        ]

        matching_service = GitHubMatchingService(
            retrieval_service=mock_retrieval_service,
            embedding_client=mock_embedding_client,
        )

        # Act
        result: GitHubMatchResult = await matching_service.match_candidate_github(
            candidate_uuid="uuid-123",
            job_query="Python Go",
            job_embedding=job_vector,
        )

        # Assert
        assert result.github_score == 1.0
        assert result.best_project is not None
        assert result.best_project.name == "p2"
        assert result.best_embedding == [1.0, 0.0]

    @pytest.mark.asyncio
    async def test_match_candidate_no_github_returns_none(
        self, mock_retrieval_service: AsyncMock
    ) -> None:
        """Test ứng viên không có GitHub -> github_score = None (Đúng thiết kế Re-weighting)."""
        mock_retrieval_service.retrieve_relevant_projects.return_value = []

        matching_service = GitHubMatchingService(
            retrieval_service=mock_retrieval_service
        )

        result = await matching_service.match_candidate_github(
            candidate_uuid="no-github-uuid",
            job_query="Python",
            job_embedding=[1.0, 0.0],
        )

        assert result.github_score is None
        assert result.best_project is None
        assert result.best_embedding is None