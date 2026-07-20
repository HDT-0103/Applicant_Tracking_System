import uuid
import tempfile
import os

import structlog

from modules.ingestion.domain.models import IngestionResponse
from modules.ingestion.infra.azure_blob_service import AzureBlobService
from modules.ingestion.infra.azure_service_bus_service import AzureServiceBusService
from modules.ingestion.application.ingestion_service import process_cv_resume
from modules.shared.infrastructure.config import Settings

logger = structlog.get_logger(__name__)


class AzureIngestionService:
    def __init__(
        self,
        blob_service: AzureBlobService,
        service_bus_service: AzureServiceBusService,
        settings: Settings,
    ) -> None:
        self._blob_service = blob_service
        self._service_bus_service = service_bus_service
        self._settings = settings

    async def ingest_pdf(self, file_content: bytes) -> IngestionResponse:
        candidate_uuid = str(uuid.uuid4())

        logger.info(
            "azure.ingestion.start",
            candidate_uuid=candidate_uuid,
            file_size_bytes=len(file_content),
        )

        storage_url = self._blob_service.upload_pdf(candidate_uuid, file_content)

        # Parse PDF to extract social links immediately
        logger.info(
            "azure.ingestion.parsing_pdf",
            candidate_uuid=candidate_uuid,
        )
        
        # Save to temporary file for parsing
        with tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.pdf') as temp_file:
            temp_file.write(file_content)
            temp_path = temp_file.name
        
        try:
            # Parse CV to extract social links
            candidate = await process_cv_resume(candidate_uuid, temp_path, self._settings, cv_file_path=storage_url)
            logger.info(
                "azure.ingestion.parsed",
                candidate_uuid=candidate_uuid,
                github_username=candidate.github_username,
                linkedin_url=candidate.linkedin_url,
                cv_file_path=storage_url,
            )
        except Exception as e:
            logger.error(
                "azure.ingestion.parse_failed",
                candidate_uuid=candidate_uuid,
                error=str(e),
            )
        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.unlink(temp_path)

        self._service_bus_service.publish_cv_received_event(
            candidate_uuid=candidate_uuid, storage_url=storage_url
        )

        logger.info(
            "azure.ingestion.complete",
            candidate_uuid=candidate_uuid,
            storage_url=storage_url,
        )

        return IngestionResponse(
            status="Accepted",
            candidate_uuid=candidate_uuid,
            storage_url=storage_url,
            message="CV successfully ingested and processing event published",
        )
