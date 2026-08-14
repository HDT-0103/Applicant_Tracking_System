from unittest.mock import AsyncMock
import pytest

from src.backend.app.services.summary_matching import SummaryMatchingService


@pytest.fixture
def mock_embedding_repo() -> AsyncMock:
    repo = AsyncMock()
    repo.get_candidate_summary_embedding = AsyncMock()
    return repo


@pytest.fixture
def mock_job_embedding_repo() -> AsyncMock:
    repo = AsyncMock()
    repo.get_job_summary_embedding = AsyncMock()
    return repo


class TestSummaryMatchingService:

    @pytest.mark.asyncio
    async def test_match_summary_valid_vectors_returns_score(
        self, mock_embedding_repo: AsyncMock, mock_job_embedding_repo: AsyncMock
    ) -> None:
        """1. Candidate Summary + Job Embedding hợp lệ -> Trả về score khớp."""
        # Arrange: Identical normalized vectors -> Similarity = 1.0
        mock_embedding_repo.get_candidate_summary_embedding.return_value = [1.0, 0.0]
        mock_job_embedding_repo.get_job_summary_embedding.return_value = [1.0, 0.0]

        service = SummaryMatchingService(
            embedding_repository=mock_embedding_repo,
            job_embedding_repository=mock_job_embedding_repo,
        )

        # Act
        score = await service.match_summary(
            candidate_uuid="cand-123", job_posting_id="job-456"
        )

        # Assert
        assert score == 1.0

    @pytest.mark.asyncio
    async def test_match_summary_missing_candidate_embedding_returns_none(
        self, mock_embedding_repo: AsyncMock, mock_job_embedding_repo: AsyncMock
    ) -> None:
        """2. Thiếu Candidate Summary Embedding -> Trả về None."""
        mock_embedding_repo.get_candidate_summary_embedding.return_value = None
        mock_job_embedding_repo.get_job_summary_embedding.return_value = [1.0, 0.0]

        service = SummaryMatchingService(
            embedding_repository=mock_embedding_repo,
            job_embedding_repository=mock_job_embedding_repo,
        )

        score = await service.match_summary(
            candidate_uuid="cand-123", job_posting_id="job-456"
        )

        assert score is None

    @pytest.mark.asyncio
    async def test_match_summary_missing_job_embedding_returns_none(
        self, mock_embedding_repo: AsyncMock, mock_job_embedding_repo: AsyncMock
    ) -> None:
        """3. Thiếu Job Posting Embedding -> Trả về None."""
        mock_embedding_repo.get_candidate_summary_embedding.return_value = [1.0, 0.0]
        mock_job_embedding_repo.get_job_summary_embedding.return_value = None

        service = SummaryMatchingService(
            embedding_repository=mock_embedding_repo,
            job_embedding_repository=mock_job_embedding_repo,
        )

        score = await service.match_summary(
            candidate_uuid="cand-123", job_posting_id="job-456"
        )

        assert score is None

    @pytest.mark.asyncio
    async def test_match_summary_empty_vector_returns_none(
        self, mock_embedding_repo: AsyncMock, mock_job_embedding_repo: AsyncMock
    ) -> None:
        """4. Vector bị rỗng -> Trả về None."""
        mock_embedding_repo.get_candidate_summary_embedding.return_value = []
        mock_job_embedding_repo.get_job_summary_embedding.return_value = [1.0, 0.0]

        service = SummaryMatchingService(
            embedding_repository=mock_embedding_repo,
            job_embedding_repository=mock_job_embedding_repo,
        )

        score = await service.match_summary(
            candidate_uuid="cand-123", job_posting_id="job-456"
        )

        assert score is None

    @pytest.mark.asyncio
    async def test_match_summary_dimension_mismatch_returns_none(
        self, mock_embedding_repo: AsyncMock, mock_job_embedding_repo: AsyncMock
    ) -> None:
        """5. Mệch kích thước vector -> Trả về None."""
        mock_embedding_repo.get_candidate_summary_embedding.return_value = [1.0, 0.0, 0.5]
        mock_job_embedding_repo.get_job_summary_embedding.return_value = [1.0, 0.0]

        service = SummaryMatchingService(
            embedding_repository=mock_embedding_repo,
            job_embedding_repository=mock_job_embedding_repo,
        )

        score = await service.match_summary(
            candidate_uuid="cand-123", job_posting_id="job-456"
        )

        assert score is None