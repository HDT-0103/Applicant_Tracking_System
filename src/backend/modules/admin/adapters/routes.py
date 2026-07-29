from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database.connection import get_db_session
from modules.admin.application.admin_service import AdminService
from modules.auth.domain.models import AuthUser
from modules.shared.infrastructure.auth_dependencies import get_current_user, require_roles

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_roles("admin"))] # Global check for admin role
)

def get_admin_service(
    db: Annotated[AsyncSession, Depends(get_db_session)]
) -> AdminService:
    return AdminService(db)

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
    current_user: Annotated[AuthUser, Depends(require_roles("admin"))],
    admin_service: Annotated[AdminService, Depends(get_admin_service)],
):
    role = payload.get("role")
    is_approved = payload.get("is_approved")
    if role is None and is_approved is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide 'role' and/or 'is_approved' to update",
        )
    try:
        return await admin_service.update_user(user_id, role, is_approved, current_user.id)
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
                "id": str(p.id),
                "role": p.role,
                "resource": p.resource,
                "field_name": p.field_name,
                "is_masked": p.is_masked,
                "masking_pattern": p.masking_pattern
            } for p in policies
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.put("/abac/policies/{policy_id}")
async def update_policy(
    policy_id: str,
    payload: dict,
    admin_service: Annotated[AdminService, Depends(get_admin_service)]
):
    is_masked = payload.get("is_masked")
    if is_masked is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing is_masked boolean field"
        )
    
    try:
        policy = await admin_service.update_abac_policy(policy_id, is_masked)
        return {
            "id": str(policy.id),
            "role": policy.role,
            "resource": policy.resource,
            "field_name": policy.field_name,
            "is_masked": policy.is_masked
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
    admin_service: Annotated[AdminService, Depends(get_admin_service)]
):
    try:
        success = await admin_service.revoke_session(jti)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
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
    admin_service: Annotated[AdminService, Depends(get_admin_service)]
):
    try:
        return await admin_service.trigger_vector_reindex()
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
    limit: int = 50
):
    try:
        return await admin_service.get_audit_logs(query, limit)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
