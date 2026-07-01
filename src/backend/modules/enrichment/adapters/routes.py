import asyncio
import structlog
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from modules.auth.domain.models import AuthUser
from modules.enrichment.application.enrichment_service import (
    candidate_enrichments,
    enrichment_worker,
    active_websockets,
    get_candidate_social_links
)
from modules.enrichment.domain.models import CandidateEnrichment, EnrichmentStatus
from modules.shared.infrastructure.auth_dependencies import require_roles
from modules.shared.infrastructure.config import Settings, get_settings

router = APIRouter(prefix="/api/enrichment", tags=["enrichment"])
logger = structlog.get_logger(__name__)


@router.post("/{candidate_uuid}/sync", status_code=status.HTTP_202_ACCEPTED)
async def sync_candidate_profile(
    candidate_uuid: str,
    background_tasks: BackgroundTasks,
    current_user: Annotated[AuthUser, Depends(require_roles("recruiter", "admin"))],
    settings: Annotated[Settings, Depends(get_settings)]
) -> dict:
    social_links = get_candidate_social_links(candidate_uuid)
    
    # Always queue the enrichment worker regardless of social links - it will generate mock analytics if needed
    candidate_enrichments[candidate_uuid] = CandidateEnrichment(
        candidate_uuid=candidate_uuid,
        enrichment_status=EnrichmentStatus.QUEUED
    )
    
    background_tasks.add_task(enrichment_worker, candidate_uuid, settings)
    
    if not social_links.github_username and not social_links.linkedin_url:
        logger.warning(
            "enrichment.sync.no_profiles",
            candidate_uuid=candidate_uuid,
            user_id=current_user.id,
            user_email=current_user.email
        )
        return {
            "status": "queued",
            "redirect": "/candidate-profile/enriched",
            "candidate_uuid": candidate_uuid
        }
    
    logger.info(
        "enrichment.sync.started",
        candidate_uuid=candidate_uuid,
        user_id=current_user.id,
        user_email=current_user.email
    )
    
    return {
        "status": "queued",
        "redirect": "/candidate-profile/enriched",
        "candidate_uuid": candidate_uuid
    }


@router.get("/{candidate_uuid}", response_model=CandidateEnrichment)
async def get_enrichment_status(
    candidate_uuid: str,
    current_user: Annotated[AuthUser, Depends(require_roles("recruiter", "admin"))]
) -> CandidateEnrichment:
    if candidate_uuid not in candidate_enrichments:
        return CandidateEnrichment(
            candidate_uuid=candidate_uuid,
            enrichment_status=EnrichmentStatus.QUEUED
        )
    return candidate_enrichments[candidate_uuid]


@router.websocket("/ws/v1/analysis/{candidate_uuid}")
async def websocket_endpoint(websocket: WebSocket, candidate_uuid: str):
    await websocket.accept()
    
    # If enrichment has already completed, send result immediately
    existing = candidate_enrichments.get(candidate_uuid)
    if existing and existing.enrichment_status == EnrichmentStatus.ENRICHED and existing.enriched_profile:
        await websocket.send_json({
            "status": "ENRICHED",
            "data": existing.enriched_profile.model_dump()
        })
        await websocket.close()
        return
    
    if candidate_uuid not in active_websockets:
        active_websockets[candidate_uuid] = []
    
    active_websockets[candidate_uuid].append(websocket)
    
    try:
        # Keep connection alive without waiting for messages
        while True:
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        if candidate_uuid in active_websockets:
            if websocket in active_websockets[candidate_uuid]:
                active_websockets[candidate_uuid].remove(websocket)
            if not active_websockets[candidate_uuid]:
                del active_websockets[candidate_uuid]
