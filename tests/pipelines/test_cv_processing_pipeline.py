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

# ---------------------------------------------------------------------------
# Hành vi cần giữ khi pipeline được nối vào luồng upload thật
# ---------------------------------------------------------------------------

def _pipeline(mock_repos, mock_services):
    return CVProcessingPipeline(
        enrichment_repo=mock_repos["enrichment_repo"],
        embedding_repo=mock_repos["embedding_repo"],
        application_repo=mock_repos["application_repo"],
        job_posting_repo=mock_repos["job_posting_repo"],
        job_embedding_repo=mock_repos["job_embedding_repo"],
        parser_service=mock_services["parser_service"],
        llm_service=mock_services["llm_service"],
        embedding_service=mock_services["embedding_service"],
    )


def _profile(profile_id):
    return EnrichmentProfile(id=profile_id, candidate_uuid="cand-123", skills=["Python"],
                             summary="s", experience="e", enrichment_status=EnrichmentStatus.ENRICHED.value)


@pytest.mark.asyncio
async def test_resume_text_skips_the_file_and_is_still_cleaned(mock_repos, mock_services):
    # Luồng upload thật xoá file tạm ngay trong request; pipeline chạy nền chỉ
    # còn text. Không được đọc file, nhưng vẫn phải chuẩn hoá text như đọc file.
    mock_services["parser_service"].cleanup = MagicMock(side_effect=lambda t: t.strip())
    mock_repos["enrichment_repo"].get_profile.return_value = _profile(uuid4())
    mock_repos["enrichment_repo"].update_profile.return_value = _profile(uuid4())

    result = await _pipeline(mock_repos, mock_services).process_cv(
        candidate_uuid="cand-123", resume_text="  raw CV text  ",
    )

    mock_services["parser_service"].process.assert_not_called()
    mock_services["llm_service"].analyze_resume.assert_called_once_with("raw CV text")
    assert result is None  # không có tin → không có điểm


@pytest.mark.asyncio
async def test_without_a_job_the_profile_and_vectors_are_saved_but_nothing_is_scored(mock_repos, mock_services):
    mock_repos["enrichment_repo"].get_profile.return_value = None
    mock_repos["enrichment_repo"].create_profile.return_value = _profile(uuid4())

    result = await _pipeline(mock_repos, mock_services).process_cv(
        candidate_uuid="cand-123", resume_text="CV",
    )

    assert result is None
    mock_repos["embedding_repo"].create_embeddings.assert_called_once()
    mock_repos["job_posting_repo"].get_job_posting.assert_not_called()
    mock_repos["application_repo"].update_matching_scores.assert_not_called()


@pytest.mark.asyncio
async def test_empty_text_is_refused_rather_than_analysed(mock_repos, mock_services):
    # PDF scan ảnh: gửi chuỗi rỗng cho LLM chỉ sinh ra một hồ sơ bịa.
    mock_services["parser_service"].cleanup = MagicMock(return_value="")
    with pytest.raises(ValueError):
        await _pipeline(mock_repos, mock_services).process_cv(candidate_uuid="cand-123", resume_text="   ")
    mock_services["llm_service"].analyze_resume.assert_not_called()


@pytest.mark.asyncio
async def test_each_cv_vector_is_compared_with_its_own_kind_of_job_vector(mock_repos, mock_services):
    """Tóm tắt CV ↔ tóm tắt tin, kinh nghiệm CV ↔ yêu cầu tin.

    Trước đây lấy job_embeddings[0] cho cả hai, nên điểm đổi theo thứ tự hàng
    PostgREST trả về. Vector từ PostgREST là CHUỖI "[...]", không phải list.
    """
    job_id, app_id = uuid4(), uuid4()
    mock_repos["enrichment_repo"].get_profile.return_value = None
    mock_repos["enrichment_repo"].create_profile.return_value = _profile(uuid4())
    mock_repos["job_posting_repo"].get_job_posting.return_value = JobPosting(id=job_id, job_title="Dev")
    # Thứ tự cố ý: requirements TRƯỚC summary.
    req = MagicMock(); req.source_type = "requirements"; req.embedding = "[0.0, 1.0]"
    summ = MagicMock(); summ.source_type = "summary"; summ.embedding = "[1.0, 0.0]"
    mock_repos["job_embedding_repo"].get_embeddings_by_job_posting.return_value = [req, summ]

    async def embed(text):
        return [1.0, 0.0] if text == "Backend Engineer" else [0.0, 1.0]
    mock_services["embedding_service"].generate_embedding = AsyncMock(side_effect=embed)
    mock_repos["application_repo"].update_matching_scores.return_value = Application(
        id=app_id, candidate_uuid="cand-123", job_posting_id=job_id, resume_id=uuid4(), overall_score=1.0)

    await _pipeline(mock_repos, mock_services).process_cv(
        candidate_uuid="cand-123", resume_text="CV", job_posting_id=job_id, application_id=app_id,
    )

    kwargs = mock_repos["application_repo"].update_matching_scores.call_args.kwargs
    assert kwargs["summary_score"] == 1.0 and kwargs["experience_score"] == 1.0
    # summary 0.3, experience 0.5, github None → bỏ khỏi mẫu số → (0.3+0.5)/0.8 = 1.0
    assert kwargs["overall_score"] == 1.0
    assert kwargs["github_score"] is None


@pytest.mark.asyncio
async def test_a_job_without_vectors_leaves_the_score_null_not_zero(mock_repos, mock_services):
    job_id, app_id = uuid4(), uuid4()
    mock_repos["enrichment_repo"].get_profile.return_value = None
    mock_repos["enrichment_repo"].create_profile.return_value = _profile(uuid4())
    mock_repos["job_posting_repo"].get_job_posting.return_value = JobPosting(id=job_id, job_title="Dev")
    mock_repos["job_embedding_repo"].get_embeddings_by_job_posting.return_value = []
    mock_repos["application_repo"].update_matching_scores.return_value = Application(
        id=app_id, candidate_uuid="cand-123", job_posting_id=job_id, resume_id=uuid4())

    await _pipeline(mock_repos, mock_services).process_cv(
        candidate_uuid="cand-123", resume_text="CV", job_posting_id=job_id, application_id=app_id,
    )

    kwargs = mock_repos["application_repo"].update_matching_scores.call_args.kwargs
    assert kwargs["overall_score"] is None and kwargs["summary_score"] is None
    # Hồ sơ vẫn nhận bảng đối chiếu kỹ năng, nhưng không có điểm bịa.
    profile_kwargs = mock_repos["enrichment_repo"].update_profile.call_args.kwargs
    assert profile_kwargs["match_confidence_score"] is None
    assert "must_have" in profile_kwargs["skill_matrix"]
