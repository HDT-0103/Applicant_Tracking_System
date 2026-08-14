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
    app.dependency_overrides[get_azure_ingestion_service] = lambda: mock_azure_service

    try:
        valid_pdf = b"%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"
        files = {"file": ("valid_candidate.pdf", valid_pdf, ALLOWED_MIME_TYPE)}
        data = {
            "full_name": "Test Candidate",
            "email": "candidate@example.com",
            "phone": "+1234567890",
        }

        with patch("modules.ingestion.adapters.azure_routes.enrichment_worker") as mock_worker:
            response = client.post("/api/v1/ingest", files=files, data=data)

            assert response.status_code in (200, 202)
            json_resp = response.json()
            assert json_resp["candidate_uuid"] == "test-uuid-1234"
            assert "storage_url" in json_resp

            # Verify azure_service.ingest_pdf was invoked
            mock_azure_service.ingest_pdf.assert_called_once()
    finally:
        app.dependency_overrides.pop(get_azure_ingestion_service, None)


def test_get_candidate_cv_signed_url(client):
    """GET /api/v1/candidates/{uuid}/cv returns a 307/302 Redirect to signed storage URL."""
    with patch("modules.ingestion.adapters.azure_routes.get_supabase_client") as mock_supa:
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
            {"cv_file_path": "https://storage.example.com/resumes/candidate-99.pdf"}
        ]
        mock_supa.return_value = mock_client

        response = client.get("/api/v1/candidates/candidate-99/cv", follow_redirects=False)

        assert response.status_code in (302, 307)
        assert "candidate-99.pdf" in response.headers["location"]
