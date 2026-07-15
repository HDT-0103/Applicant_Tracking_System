from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from modules.auth.domain.models import AuthUser
from modules.ingestion.application.azure_ingestion_service import AzureIngestionService
from modules.ingestion.domain.models import IngestionResponse
from modules.ingestion.infra.azure_blob_service import AzureBlobService
from modules.ingestion.infra.azure_service_bus_service import AzureServiceBusService
from modules.shared.infrastructure.auth_dependencies import get_current_user
from modules.shared.infrastructure.config import Settings, get_settings

router = APIRouter(prefix="/api/v1", tags=["azure-ingestion"])
logger = structlog.get_logger(__name__)

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB hard threshold
ALLOWED_MIME_TYPE = "application/pdf"


def get_azure_ingestion_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AzureIngestionService:
    blob_service = AzureBlobService(settings)
    service_bus_service = AzureServiceBusService(settings)
    return AzureIngestionService(
        blob_service=blob_service, service_bus_service=service_bus_service
    )


@router.post("/ingest", response_model=IngestionResponse, status_code=status.HTTP_202_ACCEPTED)
async def ingest_cv(
    file: Annotated[UploadFile, File(...)],
    current_user: Annotated[AuthUser, Depends(get_current_user)],
    azure_service: Annotated[AzureIngestionService, Depends(get_azure_ingestion_service)],
) -> IngestionResponse:
    if file.content_type != ALLOWED_MIME_TYPE:
        logger.warning(
            "azure.ingestion.invalid_mime_type",
            filename=file.filename,
            content_type=file.content_type,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Only {ALLOWED_MIME_TYPE} is accepted.",
        )

    file_content = await file.read()

    if len(file_content) > MAX_FILE_SIZE_BYTES:
        logger.warning(
            "azure.ingestion.file_too_large",
            filename=file.filename,
            size_bytes=len(file_content),
            max_bytes=MAX_FILE_SIZE_BYTES,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum limit of {MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.",
        )

    if not file_content.startswith(b"%PDF"):
        logger.warning(
            "azure.ingestion.invalid_pdf_magic_bytes",
            filename=file.filename,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid PDF file. Magic bytes verification failed.",
        )

    try:
        result = azure_service.ingest_pdf(file_content)
        return result
    except ValueError as exc:
        logger.error(
            "azure.ingestion.configuration_error",
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Azure service configuration error. Please check connection strings.",
        ) from exc
    except RuntimeError as exc:
        logger.error(
            "azure.ingestion.service_error",
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Azure service temporarily unavailable. Please try again later.",
        ) from exc
    except Exception as exc:
        logger.error(
            "azure.ingestion.unexpected_error",
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during ingestion.",
        ) from exc
