import asyncio
import structlog
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from modules.auth.domain.models import AuthUser
from modules.auth.infra.jwt_service import JwtService
from modules.shared.domain.roles import OPERATIONAL_ROLES, normalise_role
from modules.enrichment.application.enrichment_service import (
    candidate_enrichments,
    check_existing_enrichment,
    enrichment_worker,
    active_websockets,
    get_candidate_social_links
)
from modules.enrichment.domain.models import CandidateEnrichment, EnrichmentStatus
from modules.shared.infrastructure.abac import apply_abac
from modules.shared.infrastructure.auth_dependencies import require_operational_roles
from modules.shared.infrastructure.config import Settings, get_settings

router = APIRouter(prefix="/api/enrichment", tags=["enrichment"])
logger = structlog.get_logger(__name__)


@router.post("/{candidate_uuid}/sync", status_code=status.HTTP_202_ACCEPTED)
async def sync_candidate_profile(
    candidate_uuid: str,
    background_tasks: BackgroundTasks,
    current_user: Annotated[AuthUser, Depends(require_operational_roles())],
    settings: Annotated[Settings, Depends(get_settings)]
) -> dict:
    social_links = get_candidate_social_links(candidate_uuid)

    existing = candidate_enrichments.get(candidate_uuid)
    if existing and existing.enrichment_status == EnrichmentStatus.ENRICHED:
        logger.info(
            "enrichment.sync.already_enriched",
            candidate_uuid=candidate_uuid,
            user_id=current_user.id,
            user_email=current_user.email,
        )
        return {
            "status": "already_enriched",
            "redirect": "/candidate-profile/enriched",
            "candidate_uuid": candidate_uuid,
        }

    if existing and existing.enrichment_status in {
        EnrichmentStatus.QUEUED,
        EnrichmentStatus.IN_PROGRESS,
    }:
        logger.info(
            "enrichment.sync.already_running",
            candidate_uuid=candidate_uuid,
            status=existing.enrichment_status,
            user_id=current_user.id,
            user_email=current_user.email,
        )
        return {
            "status": "queued",
            "redirect": "/candidate-profile/enriched",
            "candidate_uuid": candidate_uuid,
        }

    # Check Supabase for existing enrichment data before re-queueing
    restored = await check_existing_enrichment(candidate_uuid, settings)
    if restored:
        candidate_enrichments[candidate_uuid] = restored
        logger.info(
            "enrichment.sync.restored_from_supabase",
            candidate_uuid=candidate_uuid,
            user_id=current_user.id,
            user_email=current_user.email,
        )
        return {
            "status": "already_enriched",
            "redirect": "/candidate-profile/enriched",
            "candidate_uuid": candidate_uuid,
        }

    # Queue the enrichment worker
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
    current_user: Annotated[AuthUser, Depends(require_operational_roles())]
) -> CandidateEnrichment:
    if candidate_uuid not in candidate_enrichments:
        return CandidateEnrichment(
            candidate_uuid=candidate_uuid,
            enrichment_status=EnrichmentStatus.QUEUED
        )
    enrichment = candidate_enrichments[candidate_uuid]
    if not enrichment.enriched_profile:
        return enrichment
    # Che trên BẢN SAO. Trước đây đoạn này gán ngược bản đã che vào
    # `enrichment` — cùng object nằm trong dict dùng chung — nên chỉ cần một
    # Tech Lead mở hồ sơ là dữ liệu thật của ứng viên biến mất với cả HR.
    masked = apply_abac(enrichment.model_dump(), current_user.role)
    return CandidateEnrichment(**masked)


#: Client phải gửi {"token": "<access token>"} ngay sau khi kết nối.
WS_AUTH_TIMEOUT_SECONDS = 10
WS_CLOSE_UNAUTHORIZED = 4401


async def _authenticate_socket(websocket: WebSocket, settings: Settings) -> str | None:
    """Đọc frame đầu tiên làm handshake xác thực, trả về role đã chuẩn hoá.

    Token đi qua message chứ không qua query string để khỏi lọt vào access log.
    Trả về ``None`` nếu không hợp lệ — caller đóng socket.
    """
    try:
        payload = await asyncio.wait_for(
            websocket.receive_json(), timeout=WS_AUTH_TIMEOUT_SECONDS
        )
    except (asyncio.TimeoutError, WebSocketDisconnect, ValueError, RuntimeError):
        return None

    token = (payload or {}).get("token") if isinstance(payload, dict) else None
    if not token:
        return None

    try:
        user = JwtService(settings).decode_token(token, expected_type="access")
    except ValueError:
        return None

    role = normalise_role(user.role)
    return role if role in OPERATIONAL_ROLES else None


@router.websocket("/ws/v1/analysis/{candidate_uuid}")
async def websocket_endpoint(
    websocket: WebSocket,
    candidate_uuid: str,
    settings: Annotated[Settings, Depends(get_settings)],
):
    await websocket.accept()

    # Endpoint này trả nguyên hồ sơ ứng viên. Trước đây nó không kiểm tra gì cả:
    # bất kỳ ai biết candidate_uuid đều kéo được toàn bộ PII, vô hiệu hoá ABAC.
    role = await _authenticate_socket(websocket, settings)
    if role is None:
        await websocket.close(code=WS_CLOSE_UNAUTHORIZED)
        return
    # Worker đọc lại role này để che payload trước khi broadcast.
    websocket.state.abac_role = role
    # Ack để client (và test) biết handshake đã xong trước khi dữ liệu chạy về.
    await websocket.send_json({"status": "AUTHENTICATED"})

    socket_registered = False

    # If enrichment has already completed, send result immediately
    existing = candidate_enrichments.get(candidate_uuid)
    if existing and existing.enrichment_status == EnrichmentStatus.ENRICHED and existing.enriched_profile:
        await websocket.send_json(apply_abac({
            "status": "ENRICHED",
            "data": existing.enriched_profile.model_dump()
        }, role))
    else:
        if candidate_uuid not in active_websockets:
            active_websockets[candidate_uuid] = []
        active_websockets[candidate_uuid].append(websocket)
        socket_registered = True
    
    try:
        # Read frames so server notices client disconnects immediately.
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    except RuntimeError:
        # Starlette can raise this when receive() is called after disconnect has been consumed.
        pass
    finally:
        if socket_registered and candidate_uuid in active_websockets:
            if websocket in active_websockets[candidate_uuid]:
                active_websockets[candidate_uuid].remove(websocket)
            if not active_websockets[candidate_uuid]:
                del active_websockets[candidate_uuid]
