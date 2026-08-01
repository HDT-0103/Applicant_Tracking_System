from datetime import datetime, timezone, timedelta
from typing import Annotated, Optional

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import RedirectResponse

from modules.ingestion.application.azure_ingestion_service import AzureIngestionService
from modules.ingestion.domain.models import IngestionResponse
from modules.ingestion.infra.azure_blob_service import AzureBlobService
from modules.ingestion.infra.azure_service_bus_service import AzureServiceBusService
from modules.enrichment.application.enrichment_service import enrichment_worker
from modules.shared.infrastructure.config import Settings, get_settings
from modules.shared.infrastructure.supabase_client import get_supabase_client

router = APIRouter(prefix="/api/v1", tags=["azure-ingestion"])
logger = structlog.get_logger(__name__)

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB hard threshold
ALLOWED_MIME_TYPE = "application/pdf"


def _assert_job_accepts_applications(job_id: str, settings: Settings) -> None:
    """
    Reject a submission whose job_id is missing, unpublished or expired.

    The public application form sends job_id from the URL, so this is the only
    place we can be sure a CV lands on the job it was meant for — the form data
    itself is client-controlled.
    """
    client = get_supabase_client(settings)
    if client is None:
        # Supabase not configured (local dev without credentials): fall through
        # rather than blocking every upload.
        logger.warning("ingestion.job_validation.skipped_no_supabase", job_id=job_id)
        return

    try:
        response = (
            client.table("jobs_posting")
            .select("id,status,expires_at")
            .eq("id", job_id)
            .limit(1)
            .execute()
        )
        rows = response.data or []
    except Exception as exc:  # noqa: BLE001 - surfaced to the applicant as 400
        logger.error("ingestion.job_validation.query_failed", job_id=job_id, error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not verify this job posting. Please try again.",
        ) from exc

    if not rows:
        logger.warning("ingestion.job_validation.not_found", job_id=job_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This job posting no longer exists.",
        )

    job = rows[0]
    if job.get("status") != "PUBLISHED":
        logger.warning("ingestion.job_validation.not_published", job_id=job_id, job_status=job.get("status"))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This job posting is not accepting applications.",
        )

    expires_at = job.get("expires_at")
    if expires_at:
        try:
            deadline = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
        except ValueError:
            logger.warning("ingestion.job_validation.bad_expires_at", job_id=job_id, expires_at=expires_at)
            return
        if deadline < datetime.now(timezone.utc):
            logger.warning("ingestion.job_validation.expired", job_id=job_id, expires_at=expires_at)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Applications for this job posting have closed.",
            )


def get_azure_ingestion_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AzureIngestionService:
    blob_service = AzureBlobService(settings)
    service_bus_service = AzureServiceBusService(settings)
    return AzureIngestionService(
        blob_service=blob_service, service_bus_service=service_bus_service, settings=settings
    )


@router.post("/ingest", response_model=IngestionResponse, status_code=status.HTTP_202_ACCEPTED)
async def ingest_cv(
    file: Annotated[UploadFile, File(...)],
    background_tasks: BackgroundTasks,
    azure_service: Annotated[AzureIngestionService, Depends(get_azure_ingestion_service)],
    settings: Annotated[Settings, Depends(get_settings)],
    full_name: Annotated[Optional[str], Form()] = None,
    email: Annotated[Optional[str], Form()] = None,
    phone: Annotated[Optional[str], Form()] = None,
    linkedin_url: Annotated[Optional[str], Form()] = None,
    github_url: Annotated[Optional[str], Form()] = None,
    job_id: Annotated[Optional[str], Form()] = None,
) -> IngestionResponse:
    # Applications from the public career page always carry a job_id; internal
    # uploads (HR dashboard) do not, and stay unaffected.
    if job_id:
        _assert_job_accepts_applications(job_id, settings)

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
        # Strip GitHub URL to extract username only
        clean_github_username = None
        if github_url:
            clean_github_username = github_url.rstrip("/").split("/")[-1] if "/" in github_url else github_url

        result = await azure_service.ingest_pdf(
            file_content,
            full_name=full_name,
            email=email,
            phone=phone,
            linkedin_url=linkedin_url,
            github_url=clean_github_username,
            job_id=job_id,
        )
        # Trigger enrichment in background (GitHub + LinkedIn + skill matrix)
        background_tasks.add_task(enrichment_worker, result.candidate_uuid, settings)
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


@router.get("/candidates/{candidate_uuid}/cv")
async def get_candidate_cv(
    candidate_uuid: str,
    settings: Settings = Depends(get_settings),
):
    """
    Safely generate a temporary 60-minute SAS Token or retrieve CV URL for candidate.
    Prevents 403 Forbidden errors when viewing/downloading CVs.
    """
    client = get_supabase_client(settings)
    cv_url = None
    if client:
        try:
            res = client.table("candidates").select("cv_file_path").eq("uuid", candidate_uuid).limit(1).execute()
            if res.data and res.data[0].get("cv_file_path"):
                cv_url = res.data[0]["cv_file_path"]
        except Exception as exc:
            logger.warning("cv.supabase_lookup_failed", candidate_uuid=candidate_uuid, error=str(exc))

    conn_str = getattr(settings, "azure_storage_connection_string", "")
    if conn_str:
        try:
            from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
            
            blob_service_client = BlobServiceClient.from_connection_string(conn_str)
            account_name = blob_service_client.account_name
            account_key = getattr(blob_service_client.credential, "account_key", None)

            if account_name and account_key:
                sas_token = generate_blob_sas(
                    account_name=account_name,
                    container_name="resumes",
                    blob_name=f"{candidate_uuid}.pdf",
                    account_key=account_key,
                    permission=BlobSasPermissions(read=True),
                    expiry=datetime.now(timezone.utc) + timedelta(hours=1)
                )
                sas_url = f"https://{account_name}.blob.core.windows.net/resumes/{candidate_uuid}.pdf?{sas_token}"
                return RedirectResponse(url=sas_url)
        except Exception as exc:
            logger.warning("cv.azure_sas_failed", candidate_uuid=candidate_uuid, error=str(exc))

    if cv_url:
        return RedirectResponse(url=cv_url)

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="CV file for this candidate was not found."
    )

