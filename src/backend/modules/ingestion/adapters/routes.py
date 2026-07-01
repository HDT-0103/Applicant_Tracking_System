import uuid
from pathlib import Path
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from modules.auth.domain.models import AuthUser
from modules.ingestion.application.ingestion_service import process_cv_resume
from modules.shared.infrastructure.auth_dependencies import require_roles
from modules.shared.infrastructure.config import Settings, get_settings

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])
logger = structlog.get_logger(__name__)

MAX_PDF_BYTES = 10 * 1024 * 1024


@router.post("/upload")
async def upload_resume(
    file: Annotated[UploadFile, File(...)],
    current_user: Annotated[AuthUser, Depends(require_roles("recruiter", "admin"))],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, str | None]:
    if file.content_type not in {"application/pdf", "application/x-pdf"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Validation failed: Document must be a valid PDF format constraint!",
        )

    content = await file.read()
    max_bytes = min(settings.max_upload_mb * 1024 * 1024, MAX_PDF_BYTES)

    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Validation failed: File size boundary limits exceed 10MB!",
        )

    if not content.startswith(b"%PDF"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Validation failed: Spoofed file asset detected. "
                "Magic byte do not match PDF!"
            ),
        )

    upload_root = Path(settings.upload_dir)
    upload_root.mkdir(parents=True, exist_ok=True)

    ingestion_uuid = str(uuid.uuid4())
    destination = upload_root / f"{ingestion_uuid}.pdf"
    destination.write_bytes(content)

    logger.info(
        "ingestion.upload.accepted",
        ingestion_uuid=ingestion_uuid,
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role,
        file_name=file.filename,
        byte_size=len(content),
    )

    # ----------------------------------------------------------------
    # Pipeline: PDF text extraction -> Gemini CV parsing -> Store record
    # ----------------------------------------------------------------
    candidate = await process_cv_resume(ingestion_uuid, str(destination), settings)

    logger.info(
        "ingestion.upload.pipeline_complete",
        uuid=candidate.uuid,
        full_name=candidate.full_name,
        github_username=candidate.github_username,
        linkedin_url=candidate.linkedin_url,
    )

    return {
        "uuid": ingestion_uuid,
        "full_name": candidate.full_name,
        "github_username": candidate.github_username,
        "linkedin_url": candidate.linkedin_url,
    }
