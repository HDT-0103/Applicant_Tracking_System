from typing import Annotated, List

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from postgrest.exceptions import APIError
from pydantic import BaseModel

from modules.auth.domain.models import AuthUser
from modules.scoring.application.job_embedding_service import (
    JobNotFoundError,
    ensure_job_embeddings,
)
from modules.shared.infrastructure.auth_dependencies import require_roles
from modules.shared.infrastructure.config import Settings, get_settings

router = APIRouter(prefix="/api/v1", tags=["scoring"])
logger = structlog.get_logger(__name__)


class EmbedJobRequest(BaseModel):
    force: bool = False


class EmbedJobResponse(BaseModel):
    job_posting_id: str
    model_name: str
    embedded: List[str]
    skipped: bool


@router.post("/jobs/{job_id}/embeddings", response_model=EmbedJobResponse)
async def embed_job_posting(
    job_id: str,
    settings: Annotated[Settings, Depends(get_settings)],
    _current_user: Annotated[AuthUser, Depends(require_roles("hr"))],
    body: EmbedJobRequest | None = None,
) -> EmbedJobResponse:
    """
    Generate (or refresh with force=true) the job_embeddings rows for a job
    posting. Idempotent: unchanged jobs are skipped unless forced.
    """
    force = bool(body and body.force)
    try:
        result = await ensure_job_embeddings(job_id, settings, force=force)
    except JobNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found.",
        )
    except RuntimeError as exc:
        logger.error("job_embeddings.unavailable", job_id=job_id, error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Embedding service is not available.",
        ) from exc
    except APIError as exc:
        logger.error("job_embeddings.db_error", job_id=job_id, error=str(exc))
        detail = "Database error while writing job embeddings."
        if getattr(exc, "code", None) == "PGRST205":
            detail = (
                "job_embeddings table is missing. "
                "Apply src/backend/migrations/V006__job_embeddings.sql first."
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail
        ) from exc

    return EmbedJobResponse(
        job_posting_id=result.job_posting_id,
        model_name=result.model_name,
        embedded=result.embedded,
        skipped=result.skipped,
    )
