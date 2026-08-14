from unittest.mock import AsyncMock
import pytest

from src.backend.app.dtos.github_matching import GitHubMatchResult
from src.backend.app.pipelines.application_matching_pipeline import (
    ApplicationMatchingPipeline,
)
from src.backend.app.services.github_retrieval import GitHubProjectDTO


@pytest.fixture
def mock_summary_service() -> AsyncMock:
    service = AsyncMock()
    service.match_summary = AsyncMock()
    return service


@pytest.fixture
def mock_experience_service() -> AsyncMock:
    service = AsyncMock()
    service.match_experience = AsyncMock()
    return service


@pytest.fixture
def mock_github_service() -> AsyncMock:
    service = AsyncMock()
    service.match_candidate_github = AsyncMock()
    return service


@pytest.fixture
def mock_app_repo() -> AsyncMock:
    repo = AsyncMock()
    repo.update_matching_scores = AsyncMock()
    return repo


class TestApplicationMatchingPipeline:

    @pytest.mark.asyncio
    async def test_full_pipeline_execution(
        self,
        mock_summary_service: AsyncMock,
        mock_experience_service: AsyncMock,
        mock_github_service: AsyncMock,
        mock_app_repo: AsyncMock,
    ) -> None:
        """1. Pipeline chạy đầy đủ cả 3 component scores và tính overall_score chính xác."""
        # Arrange
        mock_summary_service.match_summary.return_value = 0.8
        mock_experience_service.match_experience.return_value = 0.9
        
        best_proj = GitHubProjectDTO(name="ai-repo", lexical_score=0.95)
        mock_github_service.match_candidate_github.return_value = GitHubMatchResult(
            github_score=1.0,
            best_project=best_proj,
            best_embedding=[1.0, 0.0],
        )

        pipeline = ApplicationMatchingPipeline(
            summary_service=mock_summary_service,
            experience_service=mock_experience_service,
            github_service=mock_github_service,
            application_repository=mock_app_repo,
        )

        # Act
        result = await pipeline.execute_matching(
            candidate_uuid="cand-123",
            job_posting_id="job-456",
            job_query="Python FastAPI",
            job_embedding=[1.0, 0.0],
        )

        # Assert
        # overall = 0.3*0.8 + 0.5*0.9 + 0.2*1.0 = 0.89
        assert result.summary_score == 0.8
        assert result.experience_score == 0.9
        assert result.github_score == 1.0
        assert result.overall_score == 0.89
        assert result.github_project == "ai-repo"
        assert result.github_embedding == [1.0, 0.0]

        # Verify DB repository call
        mock_app_repo.update_matching_scores.assert_called_once_with(result)

    @pytest.mark.asyncio
    async def test_pipeline_execution_missing_github(
        self,
        mock_summary_service: AsyncMock,
        mock_experience_service: AsyncMock,
        mock_github_service: AsyncMock,
    ) -> None:
        """2. Pipeline với ứng viên không có GitHub -> Re-weighting tổng hợp chính xác."""
        mock_summary_service.match_summary.return_value = 0.8
        mock_experience_service.match_experience.return_value = 0.9

        pipeline = ApplicationMatchingPipeline(
            summary_service=mock_summary_service,
            experience_service=mock_experience_service,
            github_service=mock_github_service,
        )

        # Act (Không truyền job_embedding -> Không chạy github matching)
        result = await pipeline.execute_matching(
            candidate_uuid="cand-123",
            job_posting_id="job-456",
        )

        # Assert
        # overall re-weighted = (0.3*0.8 + 0.5*0.9) / 0.8 = 0.8625
        assert result.summary_score == 0.8
        assert result.experience_score == 0.9
        assert result.github_score is None
        assert result.overall_score == 0.8625
        assert result.github_project is None