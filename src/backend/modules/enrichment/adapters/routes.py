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
    get_candidate_social_links,
    load_enrichment_from_db,
)
from modules.enrichment.domain.models import CandidateEnrichment, EnrichmentStatus
from modules.shared.infrastructure.abac import apply_abac
from modules.shared.infrastructure.auth_dependencies import require_operational_roles
from modules.review.adapters.routes import get_review_repo
from modules.review.domain.repo_interface import IReviewRepo
from modules.shared.infrastructure.config import Settings, get_settings

router = APIRouter(prefix="/api/enrichment", tags=["enrichment"])
logger = structlog.get_logger(__name__)


@router.post("/{candidate_uuid}/sync", status_code=status.HTTP_202_ACCEPTED)
async def sync_candidate_profile(
    candidate_uuid: str,
    background_tasks: BackgroundTasks,
    current_user: Annotated[AuthUser, Depends(require_operational_roles())],
    settings: Annotated[Settings, Depends(get_settings)],
    review_repo: Annotated[IReviewRepo, Depends(get_review_repo)] = None,
) -> dict:
    if not await _may_view(candidate_uuid, current_user, current_user.role, review_repo):
        raise HTTPException(status_code=404, detail="Candidate not found.")

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
    current_user: Annotated[AuthUser, Depends(require_operational_roles())],
    settings: Annotated[Settings, Depends(get_settings)],
    review_repo: Annotated[IReviewRepo, Depends(get_review_repo)] = None,
) -> CandidateEnrichment:
    if not await _may_view(candidate_uuid, current_user, current_user.role, review_repo):
        raise HTTPException(status_code=404, detail="Candidate not found.")

    enrichment = candidate_enrichments.get(candidate_uuid)

    if enrichment is None:
        # Memory is only a cache. It is empty after every restart, and each
        # worker process has its own, so a miss says nothing about whether the
        # work was done — the database does.
        enrichment = load_enrichment_from_db(candidate_uuid, settings)
        if enrichment is None:
            return CandidateEnrichment(
                candidate_uuid=candidate_uuid,
                enrichment_status=EnrichmentStatus.QUEUED,
            )
        candidate_enrichments[candidate_uuid] = enrichment
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


async def _authenticate_socket(websocket: WebSocket, settings: Settings):
    """Đọc frame đầu tiên làm handshake xác thực, trả về (user, role).

    Token đi qua message chứ không qua query string để khỏi lọt vào access log.
    Trả về ``(None, None)`` nếu không hợp lệ — caller đóng socket.

    Trả về cả user chứ không chỉ role: từ V008, được xem hồ sơ hay không còn
    phụ thuộc vào việc người đó có trong hội đồng chấm ứng viên này, tức là cần
    biết họ là AI chứ không chỉ họ thuộc nhóm nào.
    """
    try:
        payload = await asyncio.wait_for(
            websocket.receive_json(), timeout=WS_AUTH_TIMEOUT_SECONDS
        )
    except (asyncio.TimeoutError, WebSocketDisconnect, ValueError, RuntimeError):
        return None, None

    token = (payload or {}).get("token") if isinstance(payload, dict) else None
    if not token:
        return None, None

    try:
        user = JwtService(settings).decode_token(token, expected_type="access")
    except ValueError:
        return None, None

    role = normalise_role(user.role)
    if role not in OPERATIONAL_ROLES:
        return None, None
    return user, role


async def _may_view(candidate_uuid: str, user, role: str, repo) -> bool:
    """Người này có được xem hồ sơ ứng viên này không?

    Nhận `repo` qua tham số chứ không tự dựng bên trong: hàm này nằm trên ranh
    giới bảo mật, mà một ranh giới không thay thế được thì không kiểm thử được
    — test buộc phải đi vào Supabase thật để hỏi một câu về phân quyền.
    """
    from modules.review.application.review_service import ReviewService

    return await ReviewService(repo=repo).may_access_candidate(
        candidate_uuid, user.id, role
    )


@router.websocket("/ws/v1/analysis/{candidate_uuid}")
async def websocket_endpoint(
    websocket: WebSocket,
    candidate_uuid: str,
    settings: Annotated[Settings, Depends(get_settings)],
    review_repo: Annotated[IReviewRepo, Depends(get_review_repo)] = None,
):
    await websocket.accept()

    # Endpoint này trả nguyên hồ sơ ứng viên. Trước đây nó không kiểm tra gì cả:
    # bất kỳ ai biết candidate_uuid đều kéo được toàn bộ PII, vô hiệu hoá ABAC.
    user, role = await _authenticate_socket(websocket, settings)
    if role is None or user is None:
        await websocket.close(code=WS_CLOSE_UNAUTHORIZED)
        return

    # Cùng luật với HTTP: tech lead ngoài hội đồng không được xem hồ sơ. Kênh
    # này trả nguyên payload enrichment nên bỏ sót ở đây là mở lại đúng cái cửa
    # mà phía HTTP vừa đóng.
    if not await _may_view(candidate_uuid, user, role, review_repo):
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
