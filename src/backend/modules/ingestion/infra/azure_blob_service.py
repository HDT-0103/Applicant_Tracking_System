import structlog
from azure.storage.blob import BlobServiceClient

from modules.shared.infrastructure.config import Settings

logger = structlog.get_logger(__name__)

BLOB_CONTAINER_NAME = "candidate-cvs"


class AzureBlobService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._connection_string = settings.azure_storage_connection_string

        if not self._connection_string:
            raise ValueError("AZURE_STORAGE_CONNECTION_STRING is not configured")

        self._blob_service_client = BlobServiceClient.from_connection_string(
            self._connection_string
        )

    def _ensure_container_exists(self) -> None:
        try:
            container_client = self._blob_service_client.get_container_client(
                BLOB_CONTAINER_NAME
            )
            if not container_client.exists():
                container_client.create_container()
                logger.info("azure.blob.container_created", name=BLOB_CONTAINER_NAME)
        except Exception as exc:
            logger.error(
                "azure.blob.container_check_failed",
                error=str(exc),
                container_name=BLOB_CONTAINER_NAME,
            )
            raise

    def upload_pdf(self, candidate_uuid: str, file_content: bytes) -> str:
        blob_name = f"{candidate_uuid}.pdf"

        try:
            self._ensure_container_exists()

            blob_client = self._blob_service_client.get_blob_client(
                container=BLOB_CONTAINER_NAME, blob=blob_name
            )

            blob_client.upload_blob(file_content, overwrite=True)

            storage_url = blob_client.url

            logger.info(
                "azure.blob.upload_success",
                candidate_uuid=candidate_uuid,
                blob_name=blob_name,
                storage_url=storage_url,
                size_bytes=len(file_content),
            )

            return storage_url

        except Exception as exc:
            logger.error(
                "azure.blob.upload_failed",
                error=str(exc),
                candidate_uuid=candidate_uuid,
                blob_name=blob_name,
            )
            raise RuntimeError(f"Failed to upload PDF to Azure Blob Storage: {exc}") from exc
