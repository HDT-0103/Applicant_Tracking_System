import uuid
import tempfile
import os

import structlog

from modules.enrichment.application.supabase_candidate_service import SupabaseCandidateService
from modules.ingestion.domain.models import IngestionResponse
from modules.ingestion.infra.application_repository import ApplicationRepository
from modules.ingestion.infra.azure_blob_service import AzureBlobService
from modules.ingestion.infra.azure_service_bus_service import AzureServiceBusService
from modules.ingestion.application.ingestion_service import process_cv_resume
from modules.shared.infrastructure.config import Settings
from modules.shared.infrastructure.supabase_client import get_supabase_client

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

    async def ingest_pdf(
        self,
        file_content: bytes,
        full_name: str = None,
        email: str = None,
        phone: str = None,
        linkedin_url: str = None,
        github_url: str = None,
        job_id: str = None,
        filename: str = None,
        screening: dict = None,
        salary_expectation: float = None,
    ) -> IngestionResponse:
        candidate_uuid = str(uuid.uuid4())

        logger.info(
            "azure.ingestion.start",
            candidate_uuid=candidate_uuid,
            file_size_bytes=len(file_content),
        )

        storage_url = self._blob_service.upload_pdf(candidate_uuid, file_content)

        resume_id, application_id = await self._persist_stage0(
            candidate_uuid=candidate_uuid,
            storage_url=storage_url,
            filename=filename,
            full_name=full_name,
            email=email,
            phone=phone,
            linkedin_url=linkedin_url,
            github_username=github_url,
            job_id=job_id,
            screening=screening,
            salary_expectation=salary_expectation,
        )

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
            candidate = await process_cv_resume(
                candidate_uuid,
                temp_path,
                self._settings,
                cv_file_path=storage_url,
                full_name=full_name,
                email=email,
                phone=phone,
                linkedin_url=linkedin_url,
                github_username=github_url,
                job_id=job_id,
            )
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

        # Bỏ qua lặng lẽ nếu Service Bus chưa cấu hình — publisher tự ghi log.
        # Hồ sơ đã lưu xong ở bước trên; enrichment do route chạy nền.
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
            # Không hứa "event published" nữa: câu đó sai khi Service Bus chưa
            # bật, và nó là thứ người vận hành đọc để tin rằng sự kiện đã đi.
            message="CV successfully ingested.",
            resume_id=resume_id,
            application_id=application_id,
        )

    async def _persist_stage0(
        self,
        candidate_uuid: str,
        storage_url: str,
        filename: str = None,
        full_name: str = None,
        email: str = None,
        phone: str = None,
        linkedin_url: str = None,
        github_username: str = None,
        job_id: str = None,
        screening: dict = None,
        salary_expectation: float = None,
    ) -> tuple:
        """
        Write candidates -> resumes -> applications inside the request, so a
        202 response means the submission is durably recorded (not just in the
        in-memory candidate_store).

        Public applications (job_id present) fail hard: without the
        applications row the submission would be silently lost to HR. Internal
        uploads without job_id are best-effort — enrichment_worker still
        upserts the candidate later.
        """
        client = get_supabase_client(self._settings, use_admin=True)
        if client is None:
            logger.warning(
                "azure.ingestion.stage0.skipped_no_supabase",
                candidate_uuid=candidate_uuid,
            )
            return None, None

        try:
            candidate_service = SupabaseCandidateService(self._settings, client)
            candidate_ok = await candidate_service.ensure_candidate_exists(
                candidate_uuid,
                storage_url,
                full_name=full_name,
                email=email,
                phone=phone,
                linkedin_url=linkedin_url,
                github_username=github_username,
                salary_expectation=salary_expectation,
            )
            if not candidate_ok:
                raise RuntimeError(f"candidates upsert failed for {candidate_uuid}")

            repository = ApplicationRepository(client)
            resume_id = repository.create_resume(candidate_uuid, filename, storage_url)

            application_id = None
            if job_id:
                application_id = repository.create_application(
                    candidate_uuid, job_id, resume_id, screening=screening
                )

            return resume_id, application_id
        except Exception as exc:
            if job_id:
                logger.error(
                    "azure.ingestion.stage0.failed",
                    candidate_uuid=candidate_uuid,
                    job_id=job_id,
                    error=str(exc),
                )
                raise RuntimeError(
                    f"Failed to record application for candidate {candidate_uuid}: {exc}"
                ) from exc
            logger.warning(
                "azure.ingestion.stage0.failed_internal_upload",
                candidate_uuid=candidate_uuid,
                error=str(exc),
            )
            return None, None
