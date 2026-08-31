from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4
import pytest

from src.backend.app.models.application import Application
from src.backend.app.models.enrichment_profile import EnrichmentProfile
from src.backend.app.models.enums import EnrichmentStatus
from src.backend.app.models.job_posting import JobPosting
from src.backend.app.pipelines.cv_processing_pipeline import CVProcessingPipeline
from src.backend.app.schemas.resume_analysis import ResumeAnalysis


@pytest.fixture
def mock_repos() -> dict[str, AsyncMock]:
    return {
        "enrichment_repo": AsyncMock(),
        "embedding_repo": AsyncMock(),
        "application_repo": AsyncMock(),
        "job_posting_repo": AsyncMock(),
        "job_embedding_repo": AsyncMock(),
    }


@pytest.fixture
def mock_services() -> dict[str, MagicMock]:
    parser = MagicMock()
    parser.process.return_value = "Parsed CV text"

    llm = MagicMock()
    llm.analyze_resume.return_value = ResumeAnalysis(
        summary="Backend Engineer",
        skills=["Python", "FastAPI"],
        strengths=["System Design"],
        weaknesses=[],
        experience=[{"company": "A", "role": "Dev", "duration": "1y", "description": "Backend"}],
    )

    embedding_service = AsyncMock()
    embedding_service.generate_embedding.return_value = [0.1, 0.2, 0.3]

    return {
        "parser_service": parser,
        "llm_service": llm,
        "embedding_service": embedding_service,
    }


@pytest.mark.asyncio
async def test_cv_processing_pipeline_success(
    mock_repos: dict[str, AsyncMock],
    mock_services: dict[str, MagicMock],
) -> None:
    # Setup Return values
    profile_id = uuid4()
    app_id = uuid4()
    job_id = uuid4()

    mock_repos["enrichment_repo"].get_profile.return_value = None
    mock_repos["enrichment_repo"].create_profile.return_value = EnrichmentProfile(
        id=profile_id,
        candidate_uuid="cand-123",
        skills=["Python"],
        summary="Backend Engineer",
        experience="...",
        enrichment_status=EnrichmentStatus.ENRICHED.value,
    )
    mock_repos["job_posting_repo"].get_job_posting.return_value = JobPosting(id=job_id, job_title="Python Dev")
    
    mock_job_emb = MagicMock()
    mock_job_emb.embedding = [0.1, 0.2, 0.3]
    mock_repos["job_embedding_repo"].get_embeddings_by_job_posting.return_value = [mock_job_emb]

    mock_repos["application_repo"].update_matching_scores.return_value = Application(
        id=app_id,
        candidate_uuid="cand-123",
        job_posting_id=job_id,
        resume_id=uuid4(),
        overall_score=0.95,
    )

    pipeline = CVProcessingPipeline(
        enrichment_repo=mock_repos["enrichment_repo"],
        embedding_repo=mock_repos["embedding_repo"],
        application_repo=mock_repos["application_repo"],
        job_posting_repo=mock_repos["job_posting_repo"],
        job_embedding_repo=mock_repos["job_embedding_repo"],
        parser_service=mock_services["parser_service"],
        llm_service=mock_services["llm_service"],
        embedding_service=mock_services["embedding_service"],
    )

    result = await pipeline.process_cv(
        file_path="cv.pdf",
        candidate_uuid="cand-123",
        job_posting_id=job_id,
        application_id=app_id,
    )

    assert result.overall_score == 0.95
    mock_repos["enrichment_repo"].create_profile.assert_called_once()
    mock_repos["embedding_repo"].create_embeddings.assert_called_once()
    mock_repos["application_repo"].update_matching_scores.assert_called_once()