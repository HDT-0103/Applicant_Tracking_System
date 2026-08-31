"""Bảng điều khiển hạ tầng và nhật ký kiểm toán phải nói thật.

Cả hai màn hình này tồn tại để admin biết hệ thống có đang hỏng không, và để
truy vết khi có chuyện. Bản trước bịa dữ liệu ở cả hai chỗ: hàng đợi luôn báo
"healthy" với mọi bộ đếm bằng 0, hạn mức API rỗng thì dựng sẵn hai dòng trông
như thật, và nhật ký thiếu IP thì điền "127.0.0.1". Đây là những test giữ cho
chuyện đó không quay lại.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from modules.admin.application.admin_service import AdminService
from modules.ingestion.infra.azure_service_bus_monitor import (
    QueueHealth,
    read_queue_health,
)

MONITOR = "modules.admin.application.admin_service.read_queue_health"


def _client(rate_limit_rows: list[dict] | None = None, audit_rows: list[dict] | None = None):
    """Supabase giả: trả về hàng đã cho, và ghi lại chuỗi lệnh đã gọi."""
    client = MagicMock()
    calls: list[tuple[str, tuple, dict]] = []

    def table(name: str):
        builder = MagicMock()
        rows = rate_limit_rows if name == "api_rate_limits" else (audit_rows or [])

        def record(method: str):
            def _call(*args, **kwargs):
                calls.append((method, args, kwargs))
                return builder
            return _call

        for method in ("select", "or_", "order", "limit", "eq"):
            setattr(builder, method, record(method))
        builder.execute = lambda: MagicMock(data=list(rows or []))
        return builder

    client.table = table
    client._calls = calls
    return client


def _service(client) -> AdminService:
    return AdminService(client=client, settings=MagicMock())


# ---------------------------------------------------------------------------
# Infrastructure metrics
# ---------------------------------------------------------------------------

class TestInfrastructureMetrics:
    @pytest.mark.asyncio
    async def test_an_unreachable_queue_is_not_reported_as_healthy(self):
        with patch(
            MONITOR,
            return_value=QueueHealth(
                queue_name="cv-received-queue",
                status="unavailable",
                detail="Could not reach the queue: timeout",
            ),
        ):
            metrics = await _service(_client()).get_infrastructure_metrics()

        bus = metrics["azure_service_bus"]
        assert bus["status"] == "unavailable"
        # Điều quan trọng nhất: bộ đếm là None, KHÔNG phải 0. Một Service Bus
        # chết mà hiện 0 tin thì trông y hệt một hàng đợi rỗng đang chạy tốt.
        assert bus["active_message_count"] is None
        assert bus["deadletter_message_count"] is None
        assert "timeout" in bus["detail"]

    @pytest.mark.asyncio
    async def test_real_counts_are_passed_through(self):
        with patch(
            MONITOR,
            return_value=QueueHealth(
                queue_name="cv-received-queue",
                status="healthy",
                active_messages=7,
                deadletter_messages=0,
            ),
        ):
            metrics = await _service(_client()).get_infrastructure_metrics()

        bus = metrics["azure_service_bus"]
        assert (bus["status"], bus["active_message_count"]) == ("healthy", 7)
        assert bus["detail"] is None

    @pytest.mark.asyncio
    async def test_an_empty_rate_limit_table_returns_an_empty_list(self):
        # Không dựng dòng github/proxycurl với hạn mức bịa nữa.
        with patch(MONITOR, return_value=QueueHealth("q", "healthy", 0, 0)):
            metrics = await _service(_client(rate_limit_rows=[])).get_infrastructure_metrics()

        assert metrics["api_rate_limits"] == []

    @pytest.mark.asyncio
    async def test_rate_limits_come_from_the_table(self):
        rows = [{
            "provider": "github",
            "rate_limit_total": 5000,
            "rate_limit_remaining": 12,
            "rate_limit_reset": "2026-09-01T00:00:00Z",
        }]
        with patch(MONITOR, return_value=QueueHealth("q", "healthy", 0, 0)):
            metrics = await _service(_client(rate_limit_rows=rows)).get_infrastructure_metrics()

        assert metrics["api_rate_limits"] == [{
            "provider": "github",
            "rate_limit_total": 5000,
            "rate_limit_remaining": 12,
            "rate_limit_reset": "2026-09-01T00:00:00Z",
        }]


class TestQueueHealth:
    def test_a_missing_connection_string_says_so_instead_of_raising(self):
        settings = MagicMock()
        settings.azure_service_bus_connection_string = ""

        health = read_queue_health(settings)

        assert health.status == "not_configured"
        assert health.active_messages is None

    def test_dead_lettered_messages_make_the_queue_degraded(self):
        # Tin trong deadletter là CV đã nhận nhưng xử lý hỏng hẳn — hồ sơ ứng
        # viên đang mất tích. Không thể gọi là "healthy".
        settings = MagicMock()
        settings.azure_service_bus_connection_string = "Endpoint=sb://x"

        props = MagicMock(active_message_count=0, dead_letter_message_count=3)
        admin_client = MagicMock()
        admin_client.__enter__ = lambda self: self
        admin_client.__exit__ = lambda *a: False
        admin_client.get_queue_runtime_properties = lambda name: props

        with patch(
            "azure.servicebus.management.ServiceBusAdministrationClient"
        ) as sdk:
            sdk.from_connection_string.return_value = admin_client
            health = read_queue_health(settings)

        assert health.status == "degraded"
        assert health.deadletter_messages == 3
        assert "3 message(s)" in health.detail


# ---------------------------------------------------------------------------
# Audit trail
# ---------------------------------------------------------------------------

class TestAuditLogs:
    @pytest.mark.asyncio
    async def test_the_search_term_is_pushed_down_to_the_database(self):
        client = _client(audit_rows=[])
        await _service(client).get_audit_logs(query="deleted", limit=50)

        methods = [c[0] for c in client._calls]
        or_calls = [c for c in client._calls if c[0] == "or_"]

        assert or_calls, "search must filter in the query, not after the limit"
        # Lọc phải đứng TRƯỚC limit, nếu không thì chỉ tìm trong 50 dòng mới nhất.
        assert methods.index("or_") < methods.index("limit")
        assert "deleted" in or_calls[0][1][0]

    @pytest.mark.asyncio
    async def test_a_comma_in_the_search_term_cannot_inject_a_second_filter(self):
        client = _client(audit_rows=[])
        await _service(client).get_audit_logs(query="a,b.eq.c")

        clause = [c for c in client._calls if c[0] == "or_"][0][1][0]
        # Dấu phẩy của PostgREST tách điều kiện; để lọt thì người dùng tự thêm
        # được vế lọc thứ hai.
        assert "a,b" not in clause

    @pytest.mark.asyncio
    async def test_no_search_term_means_no_filter(self):
        client = _client(audit_rows=[])
        await _service(client).get_audit_logs(query="   ")

        assert not [c for c in client._calls if c[0] == "or_"]

    @pytest.mark.asyncio
    async def test_a_missing_ip_stays_missing(self):
        rows = [{
            "id": "log-1",
            "action": "candidate.viewed",
            "created_at": "2026-09-01T00:00:00Z",
            "users": None,
            "ip_address": None,
            "user_agent": None,
        }]
        logs = await _service(_client(audit_rows=rows)).get_audit_logs()

        assert logs[0]["ip_address"] is None
        assert logs[0]["user_agent"] is None
        # Dòng không gắn user là worker hoặc ứng viên chưa có tài khoản — đó là
        # suy luận đúng từ dữ liệu, không phải bịa.
        assert logs[0]["user_name"] == "System/Candidate"

    @pytest.mark.asyncio
    async def test_a_recorded_ip_is_reported_as_is(self):
        rows = [{
            "id": "log-1",
            "action": "candidate.viewed",
            "created_at": "2026-09-01T00:00:00Z",
            "users": {"name": "Trí", "email": "tri@smartats.com"},
            "ip_address": "203.0.113.9",
            "user_agent": "Mozilla/5.0",
        }]
        logs = await _service(_client(audit_rows=rows)).get_audit_logs()

        assert logs[0]["ip_address"] == "203.0.113.9"
        assert logs[0]["user_email"] == "tri@smartats.com"
