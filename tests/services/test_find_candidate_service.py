from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from src.backend.app.dtos.find_candidate import FindCandidateRequest
from src.backend.app.services.find_candidate_service import FindCandidateService


def _service(search_repo, candidate_repo, embedding_repo):
    return FindCandidateService(
        search_repository=search_repo,
        candidate_repository=candidate_repo,
        embedding_service=embedding_repo,
    )


@pytest.mark.asyncio
async def test_empty_skill_match_stops_before_search_or_embedding():
    search_repo = SimpleNamespace(
        get_candidate_ids_by_skills=AsyncMock(return_value=[]),
        search_profiles_lexically=AsyncMock(),
        search_similar_embeddings=AsyncMock(),
    )
    candidate_repo = SimpleNamespace(get_candidate_details=AsyncMock())
    embedding_service = SimpleNamespace(embed_text=AsyncMock())
    service = _service(search_repo, candidate_repo, embedding_service)

    result = await service.find(
        FindCandidateRequest(
            role_description="Backend engineer",
            must_have_skills=["Rust"],
        )
    )

    assert result == []
    search_repo.search_profiles_lexically.assert_not_awaited()
    search_repo.search_similar_embeddings.assert_not_awaited()
    embedding_service.embed_text.assert_not_awaited()


@pytest.mark.asyncio
async def test_fuses_scores_and_returns_descending_hydrated_results():
    first_id, second_id = uuid4(), uuid4()
    search_repo = SimpleNamespace(
        get_candidate_ids_by_skills=AsyncMock(
            return_value=[SimpleNamespace(candidate_uuid=first_id), SimpleNamespace(candidate_uuid=second_id)]
        ),
        search_profiles_lexically=AsyncMock(
            return_value=[
                SimpleNamespace(candidate_uuid=first_id, lexical_score=10.0),
                SimpleNamespace(candidate_uuid=second_id, lexical_score=5.0),
            ]
        ),
        search_similar_embeddings=AsyncMock(
            return_value=[
                SimpleNamespace(candidate_uuid=first_id, similarity_score=0.5),
                SimpleNamespace(candidate_uuid=second_id, similarity_score=0.9),
            ]
        ),
    )
    candidate_repo = SimpleNamespace(
        get_candidate_details=AsyncMock(
            return_value=[
                {"candidate_uuid": first_id, "full_name": "First", "skills": ["Python"]},
                {"candidate_uuid": second_id, "full_name": "Second", "skills": ["Go"]},
            ]
        )
    )
    embedding_service = SimpleNamespace(embed_text=lambda text: [1.0, 2.0])
    service = _service(search_repo, candidate_repo, embedding_service)

    result = await service.find(
        FindCandidateRequest(
            role_description="Backend engineer",
            must_have_skills=["Python"],
            top_k=2,
        )
    )

    assert [item.full_name for item in result] == ["Second", "First"]
    assert result[0].overall_score == 0.76
    assert result[1].overall_score == 0.675
    search_repo.search_profiles_lexically.assert_awaited_once_with(
        query="Backend engineer", top_k=2, candidate_ids=[str(first_id), str(second_id)]
    )
    search_repo.search_similar_embeddings.assert_awaited_once_with(
        embedding=[1.0, 2.0],
        top_k=2,
        candidate_ids=[str(first_id), str(second_id)],
        source_types=["summary", "experience"],
    )