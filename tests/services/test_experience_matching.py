from unittest.mock import AsyncMock
import pytest

from src.backend.app.services.experience_matching import ExperienceMatchingService


@pytest.fixture
def mock_embedding_repo() -> AsyncMock:
    repo = AsyncMock()
    repo.get_candidate_experience_embedding = AsyncMock()
    return repo


@pytest.fixture
def mock_job_embedding_repo() -> AsyncMock:
    repo = AsyncMock()
    repo.get_job_requirements_embedding = AsyncMock()
    return repo


class TestExperienceMatchingService:

    @pytest.mark.asyncio
    async def test_match_experience_valid_vectors_returns_score(
        self, mock_embedding_repo: AsyncMock, mock_job_embedding_repo: AsyncMock
    ) -> None:
        """1. Candidate Experience + Job Requirements Embedding hợp lệ -> Trả về score khớp."""
        # Arrange: Identical normalized vectors -> Similarity = 1.0
        mock_embedding_repo.get_candidate_experience_embedding.return_value = [0.6, 0.8]
        mock_job_embedding_repo.get_job_requirements_embedding.return_value = [0.6, 0.8]

        service = ExperienceMatchingService(
            embedding_repository=mock_embedding_repo,
            job_embedding_repository=mock_job_embedding_repo,
        )

        # Act
        score = await service.match_experience(
            candidate_uuid="cand-123", job_posting_id="job-456"
        )

        # Assert
        assert score == 1.0

    @pytest.mark.asyncio
    async def test_match_experience_missing_candidate_embedding_returns_none(
        self, mock_embedding_repo: AsyncMock, mock_job_embedding_repo: AsyncMock
    ) -> None:
        """2. Thiếu Candidate Experience Embedding -> Trả về None."""
        mock_embedding_repo.get_candidate_experience_embedding.return_value = None
        mock_job_embedding_repo.get_job_requirements_embedding.return_value = [1.0, 0.0]

        service = ExperienceMatchingService(
            embedding_repository=mock_embedding_repo,
            job_embedding_repository=mock_job_embedding_repo,
        )

        score = await service.match_experience(
            candidate_uuid="cand-123", job_posting_id="job-456"
        )

        assert score is None

    @pytest.mark.asyncio
    async def test_match_experience_missing_job_embedding_returns_none(
        self, mock_embedding_repo: AsyncMock, mock_job_embedding_repo: AsyncMock
    ) -> None:
        """3. Thiếu Job Requirements Embedding -> Trả về None."""
        mock_embedding_repo.get_candidate_experience_embedding.return_value = [1.0, 0.0]
        mock_job_embedding_repo.get_job_requirements_embedding.return_value = None

        service = ExperienceMatchingService(
            embedding_repository=mock_embedding_repo,
            job_embedding_repository=mock_job_embedding_repo,
        )

        score = await service.match_experience(
            candidate_uuid="cand-123", job_posting_id="job-456"
        )

        assert score is None

    @pytest.mark.asyncio
    async def test_match_experience_empty_vector_returns_none(
        self, mock_embedding_repo: AsyncMock, mock_job_embedding_repo: AsyncMock
    ) -> None:
        """4. Vector rỗng -> Trả về None."""
        mock_embedding_repo.get_candidate_experience_embedding.return_value = []
        mock_job_embedding_repo.get_job_requirements_embedding.return_value = [1.0, 0.0]

        service = ExperienceMatchingService(
            embedding_repository=mock_embedding_repo,
            job_embedding_repository=mock_job_embedding_repo,
        )

        score = await service.match_experience(
            candidate_uuid="cand-123", job_posting_id="job-456"
        )

        assert score is None

    @pytest.mark.asyncio
    async def test_match_experience_dimension_mismatch_returns_none(
        self, mock_embedding_repo: AsyncMock, mock_job_embedding_repo: AsyncMock
    ) -> None:
        """5. Lệch kích thước vector -> Trả về None."""
        mock_embedding_repo.get_candidate_experience_embedding.return_value = [1.0, 0.0, 0.5]
        mock_job_embedding_repo.get_job_requirements_embedding.return_value = [1.0, 0.0]

        service = ExperienceMatchingService(
            embedding_repository=mock_embedding_repo,
            job_embedding_repository=mock_job_embedding_repo,
        )

        score = await service.match_experience(
            candidate_uuid="cand-123", job_posting_id="job-456"
        )

        assert score is None