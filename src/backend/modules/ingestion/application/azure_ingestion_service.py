import uuid

import structlog

from modules.ingestion.domain.models import IngestionResponse
from modules.ingestion.infra.azure_blob_service import AzureBlobService
from modules.ingestion.infra.azure_service_bus_service import AzureServiceBusService

logger = structlog.get_logger(__name__)


class AzureIngestionService:
    def __init__(
        self,
        blob_service: AzureBlobService,
        service_bus_service: AzureServiceBusService,
    ) -> None:
        self._blob_service = blob_service
        self._service_bus_service = service_bus_service

    def ingest_pdf(self, file_content: bytes) -> IngestionResponse:
        candidate_uuid = str(uuid.uuid4())

        logger.info(
            "azure.ingestion.start",
            candidate_uuid=candidate_uuid,
            file_size_bytes=len(file_content),
        )

        storage_url = self._blob_service.upload_pdf(candidate_uuid, file_content)

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
