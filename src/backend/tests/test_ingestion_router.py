"""
Unit and Integration tests for IngestionRouter (Azure PDF Ingestion).

Tests cover:
- Magic bytes validation (%PDF-)
- 10MB file size capping threshold
- MIME type enforcement (application/pdf)
- Background enrichment task queuing
- CV Signed URL redirection
"""

from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from apps.main import app
from modules.auth.domain.models import AuthUser
from modules.shared.infrastructure.auth_dependencies import get_current_user
from modules.ingestion.adapters.azure_routes import (
    ALLOWED_MIME_TYPE,
    MAX_FILE_SIZE_BYTES,
    get_azure_ingestion_service,
)
from modules.ingestion.domain.models import IngestionResponse


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def as_role():
    """Sign the caller in as a given role for the duration of one test."""

    def _apply(role: str) -> None:
        app.dependency_overrides[get_current_user] = lambda: AuthUser(
            id="user-1", email=f"{role}@smartats.com", name=role.upper(), role=role
        )

    yield _apply
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture(autouse=True)
def stub_azure_service(mock_azure_service):
    """Cho mọi test một đường nạp Azure giả.

    Ba test kiểm tra VALIDATION (MIME, kích thước, magic bytes) vẫn hỏng trên
    máy không có `AZURE_SERVICE_BUS_CONNECTION_STRING`: FastAPI dựng xong toàn
    bộ dependency rồi mới chạy handler, nên request chết ở khâu dựng service và
    không bao giờ tới được đoạn kiểm tra file. Chúng không liên quan gì tới
    Azure, nên không có lý do gì bắt chúng phụ thuộc vào nó.
    """
    app.dependency_overrides[get_azure_ingestion_service] = lambda: mock_azure_service
    yield mock_azure_service
    app.dependency_overrides.pop(get_azure_ingestion_service, None)


@pytest.fixture
def mock_azure_service():
    mock = MagicMock()
    mock.ingest_pdf = AsyncMock(
        return_value=IngestionResponse(
            candidate_uuid="test-uuid-1234",
            storage_url="https://fakeaccount.blob.core.windows.net/resumes/test-uuid-1234.pdf",
            message="CV ingested successfully",
            status="success"
        )
    )
    return mock


def test_invalid_mime_type_rejected(client):
    """Uploading a non-PDF MIME type returns 400 Bad Request."""
    files = {"file": ("document.txt", b"%PDF-1.7 fake content", "text/plain")}
    response = client.post("/api/v1/ingest", files=files)

    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]


def test_file_exceeding_10mb_rejected(client):
    """Uploading a file exceeding 10MB returns 400 Bad Request."""
    large_content = b"%PDF-" + b"0" * (MAX_FILE_SIZE_BYTES + 100)
    files = {"file": ("large_resume.pdf", large_content, ALLOWED_MIME_TYPE)}
    response = client.post("/api/v1/ingest", files=files)

    assert response.status_code == 400
    assert "File size exceeds maximum limit" in response.json()["detail"]


def test_invalid_magic_bytes_rejected(client):
    """Uploading a file lacking %PDF- magic bytes header returns 400 Bad Request."""
    invalid_content = b"NOT_A_PDF_HEADER_12345"
    files = {"file": ("fake_resume.pdf", invalid_content, ALLOWED_MIME_TYPE)}
    response = client.post("/api/v1/ingest", files=files)

    assert response.status_code == 400
    assert "Magic bytes verification failed" in response.json()["detail"]


def test_valid_pdf_ingestion_success(client, mock_azure_service):
    """Uploading a valid PDF file succeeds and returns candidate_uuid."""
    valid_pdf = b"%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"
    files = {"file": ("valid_candidate.pdf", valid_pdf, ALLOWED_MIME_TYPE)}
    data = {
        "full_name": "Test Candidate",
        "email": "candidate@example.com",
        "phone": "+1234567890",
    }

    with patch("modules.ingestion.adapters.azure_routes.enrichment_worker"):
        response = client.post("/api/v1/ingest", files=files, data=data)

    assert response.status_code in (200, 202)
    body = response.json()
    assert body["candidate_uuid"] == "test-uuid-1234"
    assert "storage_url" in body
    mock_azure_service.ingest_pdf.assert_called_once()


class TestCandidateCvLink:
    """Đường dẫn xem CV gốc.

    Endpoint này từng mở hoàn toàn và trả về 302 tới một SAS URL sống một
    tiếng: biết `candidate_uuid` là tải được CV của ứng viên, không cần tài
    khoản. Nó trả JSON có gác quyền, chính là để cái nút ở giao diện gọi được
    bằng fetch có token thay vì bằng điều hướng trần.
    """

    @staticmethod
    def _supabase_returning(rows):
        client = MagicMock()
        (
            client.table.return_value.select.return_value
            .eq.return_value.limit.return_value.execute.return_value.data
        ) = rows
        return client

    def test_an_anonymous_caller_gets_nothing(self, client):
        assert client.get("/api/v1/candidates/candidate-99/cv").status_code == 401

    def test_admin_may_not_read_a_cv(self, client, as_role):
        # admin quản trị hệ thống; hồ sơ ứng viên bị che khỏi họ ở mọi nơi khác
        # nên không có lý do gì mở đường vòng ở đây.
        as_role("admin")
        assert client.get("/api/v1/candidates/candidate-99/cv").status_code == 403

    def test_a_signed_link_is_returned_as_json_with_its_lifetime(self, client, as_role):
        as_role("hr")
        signed = "https://acct.blob.core.windows.net/cvs/candidate-99.pdf?sig=abc"
        with patch(
            "modules.ingestion.adapters.azure_routes._build_sas_url", return_value=signed
        ), patch(
            "modules.ingestion.adapters.azure_routes.get_supabase_client",
            return_value=self._supabase_returning([]),
        ):
            r = client.get("/api/v1/candidates/candidate-99/cv")

        assert r.status_code == 200
        # JSON chứ không phải redirect: redirect buộc phải đi bằng điều hướng
        # trình duyệt, mà điều hướng thì không mang được header Authorization.
        assert r.json() == {"url": signed, "expires_in_seconds": 900}

    def test_a_stored_path_is_used_when_azure_cannot_sign(self, client, as_role):
        as_role("hr")
        stored = "https://storage.example.com/resumes/candidate-99.pdf"
        with patch(
            "modules.ingestion.adapters.azure_routes._build_sas_url", return_value=None
        ), patch(
            "modules.ingestion.adapters.azure_routes.get_supabase_client",
            return_value=self._supabase_returning([{"cv_file_path": stored}]),
        ):
            r = client.get("/api/v1/candidates/candidate-99/cv")

        assert r.status_code == 200
        assert r.json()["url"] == stored
        # Link không do ta ký thì ta không biết nó sống bao lâu — nói không biết.
        assert r.json()["expires_in_seconds"] is None

    def test_a_candidate_with_no_cv_is_a_404(self, client, as_role):
        as_role("hr")
        with patch(
            "modules.ingestion.adapters.azure_routes._build_sas_url", return_value=None
        ), patch(
            "modules.ingestion.adapters.azure_routes.get_supabase_client",
            return_value=self._supabase_returning([]),
        ):
            r = client.get("/api/v1/candidates/nobody/cv")

        assert r.status_code == 404


class TestServiceBusIsOptional:
    """Thiếu Service Bus KHÔNG được chặn ứng viên nộp hồ sơ.

    Sự kiện "đã nhận CV" là thông báo cho hệ thống ngoài; repo này chưa có
    consumer nào đọc hàng đợi, và enrichment do chính route chạy nền. Trước đây
    `AzureServiceBusService.__init__` ném lỗi khi thiếu connection string, nên
    một máy đã cấu hình Blob vẫn từ chối MỌI hồ sơ với 503.
    """

    @staticmethod
    def _settings(connection_string: str):
        settings = MagicMock()
        settings.azure_service_bus_connection_string = connection_string
        return settings

    def test_building_it_without_a_connection_string_does_not_raise(self):
        from modules.ingestion.infra.azure_service_bus_service import (
            AzureServiceBusService,
        )

        service = AzureServiceBusService(self._settings(""))
        assert service.enabled is False

    def test_publishing_without_configuration_is_logged_not_raised(self):
        from modules.ingestion.infra import azure_service_bus_service as mod

        service = mod.AzureServiceBusService(self._settings(""))
        with patch.object(mod, "logger") as log:
            service.publish_cv_received_event("cand-1", "https://blob/cv.pdf")

        # Im lặng bỏ qua thì không ai biết sự kiện không được phát; ném lỗi thì
        # mất luôn hồ sơ ứng viên vừa nộp.
        log.warning.assert_called_once()
        assert log.warning.call_args[0][0] == "azure.servicebus.not_configured"

    def test_a_submission_still_succeeds(self, client, mock_azure_service):
        valid_pdf = b"%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"
        with patch("modules.ingestion.adapters.azure_routes.enrichment_worker"):
            r = client.post(
                "/api/v1/ingest",
                files={"file": ("cv.pdf", valid_pdf, ALLOWED_MIME_TYPE)},
                data={"full_name": "Ứng viên", "email": "uv@example.com"},
            )
        assert r.status_code in (200, 202), r.text
