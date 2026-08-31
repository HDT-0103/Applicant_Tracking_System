from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
import os
import pytest

from src.backend.app.repositories.github_profile import GitHubProfileRepository
from src.backend.app.services.github_retrieval import (
    GitHubProjectDTO,
    GitHubRetrievalService,
)


# ==============================================================================
# 1. UNIT TESTS (Fast, Isolated, No DB Connection)
# ==============================================================================

@pytest.fixture
def mock_repository() -> AsyncMock:
    """Fixture tạo Mock Repository độc lập."""
    repo = MagicMock(spec=GitHubProfileRepository)
    repo.search_projects_lexically = AsyncMock()
    return repo


@pytest.fixture
def service(mock_repository: AsyncMock) -> GitHubRetrievalService:
    """Fixture tạo GitHubRetrievalService với Mock Repository."""
    return GitHubRetrievalService(repository=mock_repository)


class TestGitHubRetrievalServiceUnit:
    """Tập hợp Unit Tests cho GitHubRetrievalService."""

    @pytest.mark.asyncio
    async def test_retrieve_relevant_projects_success(
        self, service: GitHubRetrievalService, mock_repository: AsyncMock
    ) -> None:
        """Test trường hợp retrieval thành công và map đúng DTO."""
        # Arrange
        mock_raw_data = [
            {
                "name": "ai-resume-parser",
                "language": "Python",
                "description": "FastAPI service extracting candidate info",
                "topics": ["fastapi", "pydantic", "openai"],
                "lexical_score": 0.85,
            },
            {
                "name": "ecommerce-backend",
                "language": "Go",
                "description": "Microservices backend",
                "topics": ["go", "grpc"],
                "lexical_score": 0.42,
            },
        ]
        mock_repository.search_projects_lexically.return_value = mock_raw_data

        # Act
        results = await service.retrieve_relevant_projects(
            candidate_uuid="test-uuid-123",
            query="Python FastAPI LLM",
            top_k=2,
        )

        # Assert
        assert len(results) == 2
        assert all(isinstance(p, GitHubProjectDTO) for p in results)
        
        # Verify first item mapping
        assert results[0].name == "ai-resume-parser"
        assert results[0].language == "Python"
        assert results[0].lexical_score == 0.85
        assert results[0].topics == ["fastapi", "pydantic", "openai"]

        # Verify repository call
        mock_repository.search_projects_lexically.assert_awaited_once_with(
            candidate_uuid="test-uuid-123",
            query="Python FastAPI LLM",
            top_k=2,
        )

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "candidate_uuid, query, top_k",
        [
            ("", "Python FastAPI", 3),          # Candidate UUID rỗng
            ("uuid-123", "", 3),                # Query rỗng
            ("uuid-123", "   ", 3),             # Query chỉ có khoảng trắng
            ("uuid-123", "Python", 0),          # top_k <= 0
            ("uuid-123", "Python", -1),         # top_k âm
        ],
    )
    async def test_retrieve_projects_guard_clauses(
        self,
        service: GitHubRetrievalService,
        mock_repository: AsyncMock,
        candidate_uuid: str,
        query: str,
        top_k: int,
    ) -> None:
        """Test Guard Clauses: Khi đầu vào không hợp lệ thì trả về [] ngay lập tức."""
        results = await service.retrieve_relevant_projects(
            candidate_uuid=candidate_uuid,
            query=query,
            top_k=top_k,
        )

        assert results == []
        # Đảm bảo KHÔNG gọi repo khi dính guard clause
        mock_repository.search_projects_lexically.assert_not_called()

    @pytest.mark.asyncio
    async def test_retrieve_projects_repository_exception(
        self, service: GitHubRetrievalService, mock_repository: AsyncMock
    ) -> None:
        """Test khi Repository throw Exception (lỗi DB/Network), Service trả về [] thay vì crash."""
        mock_repository.search_projects_lexically.side_effect = Exception("Supabase RPC connection timeout")

        results = await service.retrieve_relevant_projects(
            candidate_uuid="test-uuid-123",
            query="Python",
            top_k=3,
        )

        assert results == []

    @pytest.mark.asyncio
    async def test_dto_mapping_robustness_and_fallbacks(
        self, service: GitHubRetrievalService, mock_repository: AsyncMock
    ) -> None:
        """Test tính linh hoạt và khả năng xử lý dữ liệu 'bẩn' trong _map_to_dto."""
        mock_raw_data = [
            # Case 1: Dùng fallback key `repo_name` và `score` thay vì `name` và `lexical_score`
            {
                "repo_name": "fallback-repo",
                "language": None,
                "description": None,
                "topics": None,  # topics bị None
                "score": 0.75,
            },
            # Case 2: Dùng fallback `rank`
            {
                "name": "rank-repo",
                "topics": ["python", None, 123],  # topics chứa phần tử rác/None
                "rank": 0.91,
            },
            # Case 3: Bị thiếu `name` -> Sẽ bị lọc bỏ (skip)
            {
                "language": "Java",
                "lexical_score": 0.5,
            },
            # Case 4: Không phải dict -> Sẽ bị lọc bỏ
            "invalid_string_item",
        ]
        mock_repository.search_projects_lexically.return_value = mock_raw_data

        results = await service.retrieve_relevant_projects(
            candidate_uuid="uuid-123",
            query="test",
            top_k=5,
        )

        # Chỉ 2 item hợp lệ được giữ lại
        assert len(results) == 2

        # Case 1 assertions
        assert results[0].name == "fallback-repo"
        assert results[0].topics == []
        assert results[0].lexical_score == 0.75

        # Case 2 assertions
        assert results[1].name == "rank-repo"
        assert results[1].topics == ["python", "123"]  # Đã qua clean_topics
        assert results[1].lexical_score == 0.91


# ==============================================================================
# 2. INTEGRATION TESTS (Thật với DB/Supabase)
# ==============================================================================

# Kiểm tra nếu chưa cấu hình SUPABASE_URL thì skip integration tests
RUN_INTEGRATION = os.getenv("RUN_INTEGRATION_TESTS", "false").lower() == "true"


@pytest.mark.skipif(not RUN_INTEGRATION, reason="Cần bật RUN_INTEGRATION_TESTS=true để chạy integration tests.")
class TestGitHubRetrievalServiceIntegration:
    """Integration Test thực tế giữa Backend ↔ Repository ↔ Supabase RPC."""

    @pytest.fixture
    def real_service(self) -> GitHubRetrievalService:
        """Khởi tạo service dùng Supabase client thật."""
        repo = GitHubProfileRepository()
        return GitHubRetrievalService(repository=repo)

    @pytest.mark.asyncio
    async def test_real_supabase_rpc_retrieval(
        self, real_service: GitHubRetrievalService
    ) -> None:
        """Gửi request thật xuống Supabase RPC function để kiểm tra kết quả."""
        # ⚠️ Thay candidate_uuid thật có sẵn trong Database test của bạn
        test_candidate_uuid = "00000000-0000-0000-0000-000000000000"
        test_query = "FastAPI Python LLM"

        projects = await real_service.retrieve_relevant_projects(
            candidate_uuid=test_candidate_uuid,
            query=test_query,
            top_k=3,
        )

        # Kiểm tra contract trả về
        assert isinstance(projects, list)
        if projects:
            for proj in projects:
                assert isinstance(proj, GitHubProjectDTO)
                assert isinstance(proj.name, str)
                assert isinstance(proj.lexical_score, float)