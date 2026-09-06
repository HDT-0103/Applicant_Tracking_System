from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from supabase import Client

from modules.admin.application.admin_service import AdminService, ReindexUnavailableError
from modules.auth.domain.models import AuthUser
from modules.shared.infrastructure.auth_dependencies import require_roles
from modules.shared.infrastructure.supabase_client import get_supabase_admin_client
from modules.shared.infrastructure import audit
from modules.shared.infrastructure.audit import AuditDep, client_context

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_roles("admin"))],
)


def get_admin_service(
    client: Annotated[Client, Depends(get_supabase_admin_client)]
) -> AdminService:
    return AdminService(client)


# ----------------------------------------------------
# USER MANAGEMENT & ACCESS ROUTES
# ----------------------------------------------------
@router.get("/users")
async def list_users(
    admin_service: Annotated[AdminService, Depends(get_admin_service)]
):
    try:
        return await admin_service.get_users()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    payload: dict,
    request: Request,
    current_user: Annotated[AuthUser, Depends(require_roles("admin"))],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
    recorder: AuditDep,
):
    role = payload.get("role")
    is_approved = payload.get("is_approved")
    if role is None and is_approved is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide 'role' and/or 'is_approved' to update",
        )
    try:
        updated = await admin_service.update_user(user_id, role, is_approved, current_user.id)
        ip, ua = client_context(request)
        await recorder.record(
            audit.ADMIN_USER_UPDATE,
            user_id=current_user.id, ip=ip, user_agent=ua,
            details={"target_user_id": user_id, "role": role, "is_approved": is_approved},
        )
        return updated
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ----------------------------------------------------
# ABAC POLICY ROUTES
# ----------------------------------------------------
@router.get("/abac/policies")
async def list_policies(
    admin_service: Annotated[AdminService, Depends(get_admin_service)]
):
    try:
        policies = await admin_service.get_abac_policies()
        return [
            {
                "id": str(p.id) if hasattr(p, "id") else str(p.get("id")),
                "role": getattr(p, "role", p.get("role") if isinstance(p, dict) else None),
                "resource": getattr(p, "resource", p.get("resource") if isinstance(p, dict) else None),
                "field_name": getattr(p, "field_name", p.get("field_name") if isinstance(p, dict) else None),
                "is_masked": getattr(p, "is_masked", p.get("is_masked") if isinstance(p, dict) else None),
                "masking_pattern": getattr(p, "masking_pattern", p.get("masking_pattern") if isinstance(p, dict) else None),
            }
            for p in policies
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.put("/abac/policies/{policy_id}")
async def update_policy(
    policy_id: str,
    payload: dict,
    request: Request,
    current_user: Annotated[AuthUser, Depends(require_roles("admin"))],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
    recorder: AuditDep,
):
    is_masked = payload.get("is_masked")
    if is_masked is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing is_masked boolean field",
        )

    try:
        policy = await admin_service.update_abac_policy(policy_id, is_masked)
        ip, ua = client_context(request)
        await recorder.record(
            audit.ADMIN_ABAC_UPDATE,
            user_id=current_user.id, ip=ip, user_agent=ua,
            details={"policy_id": policy_id, "is_masked": is_masked},
        )
        return {
            "id": str(policy.id) if hasattr(policy, "id") else str(policy.get("id")),
            "role": getattr(policy, "role", policy.get("role") if isinstance(policy, dict) else None),
            "resource": getattr(policy, "resource", policy.get("resource") if isinstance(policy, dict) else None),
            "field_name": getattr(policy, "field_name", policy.get("field_name") if isinstance(policy, dict) else None),
            "is_masked": getattr(policy, "is_masked", policy.get("is_masked") if isinstance(policy, dict) else None),
        }
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ----------------------------------------------------
# ACTIVE SESSION ROUTES
# ----------------------------------------------------
@router.get("/sessions")
async def list_sessions(
    admin_service: Annotated[AdminService, Depends(get_admin_service)]
):
    try:
        return await admin_service.get_active_sessions()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/sessions/{jti}/revoke")
async def revoke_session(
    jti: str,
    request: Request,
    current_user: Annotated[AuthUser, Depends(require_roles("admin"))],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
    recorder: AuditDep,
):
    try:
        success = await admin_service.revoke_session(jti)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        ip, ua = client_context(request)
        await recorder.record(audit.ADMIN_SESSION_REVOKE, user_id=current_user.id, ip=ip, user_agent=ua, details={"jti": jti})
        return {"status": "success", "message": f"Session {jti} revoked"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ----------------------------------------------------
# AI & VECTOR ROUTES
# ----------------------------------------------------
@router.get("/analytics/ai")
async def get_ai_metrics(
    admin_service: Annotated[AdminService, Depends(get_admin_service)]
):
    try:
        return await admin_service.get_ai_analytics_metrics()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/analytics/ai/timeseries")
async def get_ai_timeseries(
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
    days: int = 7,
):
    try:
        return await admin_service.get_ai_cost_timeseries(days)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/vector/reindex")
async def trigger_reindex(
    request: Request,
    current_user: Annotated[AuthUser, Depends(require_roles("admin"))],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
    recorder: AuditDep,
):
    try:
        result = await admin_service.trigger_vector_reindex()
        ip, ua = client_context(request)
        await recorder.record(audit.ADMIN_VECTOR_REINDEX, user_id=current_user.id, ip=ip, user_agent=ua)
        return result
    except ReindexUnavailableError as e:
        # 503 chứ không 200 giả: RPC chưa cài là việc của migration, không phải
        # của nút bấm.
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ----------------------------------------------------
# INFRASTRUCTURE ROUTES
# ----------------------------------------------------
@router.get("/infrastructure/metrics")
async def get_infra_metrics(
    admin_service: Annotated[AdminService, Depends(get_admin_service)]
):
    try:
        return await admin_service.get_infrastructure_metrics()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ----------------------------------------------------
# AUDIT LOG ROUTES
# ----------------------------------------------------
@router.get("/audit-logs")
async def list_audit_logs(
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
    query: str | None = None,
    limit: int = 50,
):
    try:
        return await admin_service.get_audit_logs(query, limit)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))