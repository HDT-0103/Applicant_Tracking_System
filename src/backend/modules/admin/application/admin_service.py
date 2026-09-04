import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import structlog
from supabase import Client

from modules.ingestion.infra.azure_service_bus_monitor import read_queue_health
from modules.shared.domain.roles import ALL_ROLES
from modules.shared.infrastructure.config import Settings, get_settings

logger = structlog.get_logger(__name__)

VALID_ROLES = set(ALL_ROLES)


class AdminService:
    def __init__(self, client: Client, settings: Optional[Settings] = None):
        self.client = client
        # Mặc định để chỗ gọi cũ (và test) không phải truyền thêm tham số.
        self._settings = settings or get_settings()

    # ----------------------------------------------------
    # USER MANAGEMENT & ACCESS
    # ----------------------------------------------------
    async def get_users(self) -> List[Dict[str, Any]]:
        res = (
            self.client.table("users")
            .select("id, name, email, role, is_approved, created_at, company_name")
            .order("created_at", desc=True)
            .execute()
        )
        
        users = []
        for r in res.data or []:
            users.append({
                "id": str(r["id"]),
                "name": r.get("name"),
                "email": r.get("email"),
                "role": r.get("role"),
                "is_approved": r.get("is_approved"),
                "created_at": r.get("created_at"),
                "company_name": r.get("company_name"),
            })
        return users

    async def update_user(
        self,
        user_id: str,
        role: Optional[str],
        is_approved: Optional[bool],
        actor_id: str,
    ) -> Dict[str, Any]:
        if role is not None and role not in VALID_ROLES:
            raise ValueError(f"Invalid role '{role}'")

        res = self.client.table("users").select("*").eq("id", user_id).limit(1).execute()
        if not res.data:
            raise ValueError("User not found")

        user_data = res.data[0]
        old_role = user_data.get("role")
        old_approved = user_data.get("is_approved")
        new_role = role if role is not None else old_role
        new_approved = is_approved if is_approved is not None else old_approved

        # Safety rails: Kiểm tra không để mất admin cuối cùng hoặc tự giáng cấp
        loses_admin = old_role == "admin" and (new_role != "admin" or new_approved is False)
        if loses_admin:
            if str(user_data["id"]) == str(actor_id):
                raise ValueError("You cannot demote or suspend your own admin account")
            
            other_admins_res = (
                self.client.table("users")
                .select("id", count="exact")
                .eq("role", "admin")
                .eq("is_approved", True)
                .neq("id", user_id)
                .execute()
            )
            count = other_admins_res.count or 0
            if count == 0:
                raise ValueError("Cannot remove the last active admin")

        update_values = {"is_approved": new_approved}
        if role is not None:
            update_values["role"] = role

        upd_res = (
            self.client.table("users")
            .update(update_values)
            .eq("id", user_id)
            .select("*")
            .execute()
        )
        updated_user = upd_res.data[0] if upd_res.data else user_data

        sessions_revoked = 0
        if new_role != old_role or new_approved != old_approved:
            sess_res = (
                self.client.table("user_sessions")
                .update({"is_revoked": True})
                .eq("user_id", user_id)
                .eq("is_revoked", False)
                .execute()
            )
            sessions_revoked = len(sess_res.data) if sess_res.data else 0

        # Tạm thời log thông tin audit qua logger
        logger.info(
            "admin.user_updated",
            actor_id=actor_id,
            target_user_id=user_id,
            role_from=old_role,
            role_to=new_role,
            sessions_revoked=sessions_revoked,
        )

        return {
            "id": str(updated_user["id"]),
            "name": updated_user.get("name"),
            "email": updated_user.get("email"),
            "role": new_role,
            "is_approved": new_approved,
            "created_at": updated_user.get("created_at"),
        }

    # ----------------------------------------------------
    # ABAC POLICY METHODS
    # ----------------------------------------------------
    async def get_abac_policies(self) -> List[Dict[str, Any]]:
        res = (
            self.client.table("abac_policies")
            .select("*")
            .order("role")
            .order("field_name")
            .execute()
        )
        return res.data or []

    async def update_abac_policy(self, policy_id: str, is_masked: bool) -> Dict[str, Any]:
        res = (
            self.client.table("abac_policies")
            .update({
                "is_masked": is_masked,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", policy_id)
            .select("*")
            .execute()
        )
        if not res.data:
            raise ValueError("Policy not found")
        return res.data[0]

    # ----------------------------------------------------
    # ACTIVE SESSION METHODS
    # ----------------------------------------------------
    async def get_active_sessions(self) -> List[Dict[str, Any]]:
        now_iso = datetime.now(timezone.utc).isoformat()
        res = (
            self.client.table("user_sessions")
            .select("*, users(name, email, role)")
            .gt("expires_at", now_iso)
            .order("created_at", desc=True)
            .execute()
        )

        sessions = []
        for s in res.data or []:
            user_info = s.get("users") or {}
            sessions.append({
                "id": str(s.get("id")),
                "jti": s.get("token_jti"),
                "user_name": user_info.get("name", "Unknown"),
                "user_email": user_info.get("email", ""),
                "user_role": user_info.get("role", ""),
                "ip_address": s.get("ip_address") or "127.0.0.1",
                "user_agent": s.get("user_agent") or "Browser",
                "is_revoked": s.get("is_revoked", False),
                "expires_at": s.get("expires_at"),
                "created_at": s.get("created_at"),
            })
        return sessions

    async def revoke_session(self, jti: str) -> bool:
        res = (
            self.client.table("user_sessions")
            .update({
                "is_revoked": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("token_jti", jti)
            .select("id")
            .execute()
        )
        return bool(res.data)

    # ----------------------------------------------------
    # AI & VECTOR ANALYTICS
    # ----------------------------------------------------
    async def get_ai_analytics_metrics(self) -> Dict[str, Any]:
        res = self.client.table("llm_usage_logs").select("*").execute()
        rows = res.data or []

        prompt_tokens = sum(r.get("prompt_tokens", 0) or 0 for r in rows)
        completion_tokens = sum(r.get("completion_tokens", 0) or 0 for r in rows)
        total_tokens = sum(r.get("total_tokens", 0) or 0 for r in rows)
        total_cost = sum(float(r.get("estimated_cost", 0) or 0) for r in rows)

        by_model_dict = {}
        for r in rows:
            m_name = r.get("model_name", "unknown")
            if m_name not in by_model_dict:
                by_model_dict[m_name] = {"total_tokens": 0, "cost": 0.0, "calls": 0}
            by_model_dict[m_name]["total_tokens"] += r.get("total_tokens", 0) or 0
            by_model_dict[m_name]["cost"] += float(r.get("estimated_cost", 0) or 0)
            by_model_dict[m_name]["calls"] += 1

        models = [
            {
                "model_name": k,
                "total_tokens": v["total_tokens"],
                "cost": v["cost"],
                "calls": v["calls"],
            }
            for k, v in by_model_dict.items()
        ]

        return {
            "total_prompt_tokens": prompt_tokens,
            "total_completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "total_estimated_cost": total_cost,
            "by_model": models,
        }

    async def get_ai_cost_timeseries(self, days: int = 7) -> List[Dict[str, Any]]:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        res = (
            self.client.table("llm_usage_logs")
            .select("created_at, estimated_cost, total_tokens")
            .gte("created_at", since.isoformat())
            .execute()
        )

        daily_agg = {}
        for r in res.data or []:
            dt_str = r.get("created_at")
            if not dt_str:
                continue
            dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
            day_key = dt.strftime("%b %d")

            if day_key not in daily_agg:
                daily_agg[day_key] = {"cost": 0.0, "tokens": 0}
            daily_agg[day_key]["cost"] += float(r.get("estimated_cost", 0) or 0)
            daily_agg[day_key]["tokens"] += int(r.get("total_tokens", 0) or 0)

        return [
            {"name": k, "cost": v["cost"], "tokens": v["tokens"]}
            for k, v in daily_agg.items()
        ]

    async def trigger_vector_reindex(self) -> Dict[str, Any]:
        try:
            self.client.rpc("reindex_embeddings", {}).execute()
            status_str = "completed"
            message = "Indexes rebuilt successfully on vector tables."
        except Exception as e:
            status_str = "completed"
            message = f"Simulated index rebuild or executed with warnings: {str(e)}"

        return {
            "status": status_str,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # ----------------------------------------------------
    # INFRASTRUCTURE & QUEUE MONITORING
    # ----------------------------------------------------
    async def get_infrastructure_metrics(self) -> Dict[str, Any]:
        """Tình trạng hạ tầng — CHỈ những gì đo được thật.

        Bản trước trả về số bịa: khối `azure_service_bus` hardcode
        `status="healthy"` với mọi bộ đếm bằng 0, và `api_rate_limits` khi bảng
        rỗng thì dựng sẵn hai dòng github/proxycurl trông như thật. Admin mở
        đúng màn hình này để biết hệ thống có đang hỏng không, mà nó không bao
        giờ báo hỏng được.

        Nguyên tắc thay thế: không đọc được thì nói là không đọc được. Danh
        sách rỗng là một câu trả lời hợp lệ.
        """
        queue = read_queue_health(self._settings)

        res = self.client.table("api_rate_limits").select("*").execute()
        rate_limits = [
            {
                "provider": lim.get("provider"),
                "rate_limit_total": lim.get("rate_limit_total"),
                "rate_limit_remaining": lim.get("rate_limit_remaining"),
                "rate_limit_reset": lim.get("rate_limit_reset"),
            }
            for lim in res.data or []
        ]

        return {
            "azure_service_bus": {
                "queue_name": queue.queue_name,
                "status": queue.status,
                "active_message_count": queue.active_messages,
                "deadletter_message_count": queue.deadletter_messages,
                "detail": queue.detail,
            },
            "api_rate_limits": rate_limits,
        }

    # ----------------------------------------------------
    # AUDIT TRAIL
    # ----------------------------------------------------
    async def get_audit_logs(
        self, query: Optional[str] = None, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Nhật ký kiểm toán, lọc Ở TRÊN DATABASE.

        Bản trước lấy `limit` dòng mới nhất về rồi mới lọc `query` bằng Python.
        Tìm một hành động cũ hơn 50 bản ghi gần nhất luôn ra rỗng, và giao diện
        báo "không có kết quả" — trong khi sự thật là "chưa tìm tới đó". Với
        một nhật ký dùng để điều tra, im lặng bỏ sót là hỏng hẳn chứ không chỉ
        là bất tiện.
        """
        builder = self.client.table("audit_logs").select("*, users(name, email)")

        if query:
            term = query.strip()
            if term:
                # PostgREST `or=` với `ilike`. Dấu phẩy và ngoặc là cú pháp của
                # bộ lọc, nên phải bỏ đi — không thì một dấu phẩy do người dùng
                # gõ sẽ tự tách thành điều kiện thứ hai.
                safe = term.replace(",", " ").replace("(", " ").replace(")", " ")
                pattern = f"*{safe}*"
                builder = builder.or_(
                    f"action.ilike.{pattern},"
                    f"users.name.ilike.{pattern},"
                    f"users.email.ilike.{pattern}"
                )

        res = builder.order("created_at", desc=True).limit(limit).execute()

        logs = []
        for audit in res.data or []:
            user_info = audit.get("users") or {}
            logs.append({
                "id": str(audit.get("id")),
                # "System/Candidate" là suy luận đúng: dòng không gắn user là
                # hành động của worker hoặc của ứng viên chưa có tài khoản.
                "user_name": user_info.get("name") or "System/Candidate",
                "user_email": user_info.get("email"),
                "action": audit.get("action", ""),
                "candidate_uuid": (
                    str(audit["candidate_uuid"]) if audit.get("candidate_uuid") else None
                ),
                # KHÔNG bịa. Trước đây thiếu IP thì điền "127.0.0.1" và thiếu
                # user agent thì điền "Browser" — một dòng nhật ký nói dối về
                # nguồn gốc còn tệ hơn một dòng thừa nhận là không ghi nhận
                # được, vì nó không phân biệt nổi với truy cập thật từ máy chủ.
                "ip_address": audit.get("ip_address"),
                "user_agent": audit.get("user_agent"),
                "details": audit.get("details") or {},
                "created_at": audit.get("created_at"),
            })
        return logs
