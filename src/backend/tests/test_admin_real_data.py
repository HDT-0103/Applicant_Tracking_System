"""Trang admin phải chạy trên dữ liệu THẬT: nhật ký có người ghi, phiên có IP
thật, token LLM được đếm, và không có khoá ngoại nào được giả định.

Bối cảnh: `audit_logs` và `user_sessions` KHÔNG có FK tới `users` trên Supabase
nên mọi `select("*, users(...)")` trả PGRST200 — tab Nhật ký chết ngay khi mở.
`_write_audit_log` của auth là `pass`, `llm_usage_logs` rỗng, `api_rate_limits`
rỗng, và giao diện vẽ biểu đồ "dữ liệu mẫu" lên chỗ trống.
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from modules.admin.application.admin_service import AdminService
from modules.shared.infrastructure import audit
from modules.shared.infrastructure.audit import AuditRecorder, client_context, get_audit_recorder
from modules.shared.infrastructure.llm_usage import estimate_cost, make_supabase_usage_sink
from src.backend.app.services import llm_provider


# ---------------------------------------------------------------------------
# Supabase giả: bảng nào trả gì, và ghi lại mọi chuỗi lệnh
# ---------------------------------------------------------------------------
def _client(tables: dict[str, list[dict]]):
    client = MagicMock()
    calls: list[tuple[str, str, tuple]] = []
    inserted: list[tuple[str, dict]] = []

    def table(name: str):
        builder = MagicMock()

        def record(method):
            def _call(*args, **kwargs):
                calls.append((name, method, args))
                if method == "insert":
                    inserted.append((name, args[0]))
                return builder
            return _call

        for method in ("select", "or_", "order", "limit", "eq", "gt", "in_", "insert", "upsert", "update"):
            setattr(builder, method, record(method))
        builder.execute = lambda: MagicMock(data=list(tables.get(name, [])))
        return builder

    client.table = table
    client._calls = calls
    client._inserted = inserted
    return client


USERS = [
    {"id": "u-1", "name": "Mai", "email": "mai@smartats.com", "role": "hr"},
    {"id": "u-2", "name": "Trí", "email": "tri@smartats.com", "role": "tech_lead"},
]


class TestAuditLogsWithoutForeignKey:
    @pytest.mark.asyncio
    async def test_users_are_joined_in_python_with_one_batch_query(self):
        rows = [
            {"id": "a1", "user_id": "u-1", "action": "login_password", "created_at": "2026-09-06T00:00:00Z"},
            {"id": "a2", "user_id": "u-2", "action": "review_submit", "created_at": "2026-09-06T00:01:00Z"},
            {"id": "a3", "user_id": None, "action": "upload_resume", "created_at": "2026-09-06T00:02:00Z"},
        ]
        client = _client({"audit_logs": rows, "users": USERS})
        logs = await AdminService(client, settings=MagicMock()).get_audit_logs()

        assert [l["user_name"] for l in logs] == ["Mai", "Trí", "System/Candidate"]
        assert logs[1]["user_email"] == "tri@smartats.com"
        # Không nhúng `users(...)` vào select của audit_logs — đó là chỗ từng chết.
        selects = [a for t, m, a in client._calls if t == "audit_logs" and m == "select"]
        assert selects == [("*",)]
        # Và chỉ MỘT truy vấn users cho cả lô, không phải mỗi dòng một lần.
        assert [m for t, m, a in client._calls if t == "users" and m == "in_"] == ["in_"]

    @pytest.mark.asyncio
    async def test_searching_by_a_persons_name_still_filters_in_the_database(self):
        client = _client({"audit_logs": [], "users": [USERS[1]]})
        await AdminService(client, settings=MagicMock()).get_audit_logs(query="Trí")
        audit_or = [a[0] for t, m, a in client._calls if t == "audit_logs" and m == "or_"]
        assert audit_or and "user_id.in.(u-2)" in audit_or[0] and "action.ilike.*Trí*" in audit_or[0]


class TestSessionsWithoutForeignKey:
    @pytest.mark.asyncio
    async def test_sessions_name_their_user_and_never_invent_an_origin(self):
        rows = [
            {"id": "s1", "user_id": "u-1", "token_jti": "j1", "expires_at": "2099-01-01T00:00:00Z",
             "ip_address": "203.0.113.9", "user_agent": "Mozilla/5.0", "created_at": "2026-09-06T00:00:00Z"},
            {"id": "s2", "user_id": "u-2", "token_jti": "j2", "expires_at": "2099-01-01T00:00:00Z",
             "ip_address": None, "user_agent": None, "created_at": "2026-09-06T00:00:00Z"},
        ]
        client = _client({"user_sessions": rows, "users": USERS})
        sessions = await AdminService(client, settings=MagicMock()).get_active_sessions()
        assert sessions[0]["user_name"] == "Mai" and sessions[0]["ip_address"] == "203.0.113.9"
        # Phiên cũ không có nguồn gốc: None, không phải "127.0.0.1" / "Browser".
        assert sessions[1]["ip_address"] is None and sessions[1]["user_agent"] is None
        selects = [a for t, m, a in client._calls if t == "user_sessions" and m == "select"]
        assert selects == [("*",)]


class TestAuditRecorder:
    def test_it_writes_the_row_as_given_and_reports_success(self):
        client = _client({})
        ok = AuditRecorder(client).record_sync(
            audit.REVIEW_SUBMIT, user_id="u-2", candidate_uuid="c-1", ip="203.0.113.9",
            user_agent="Mozilla", details={"decision": "approved"},
        )
        assert ok is True
        table, row = client._inserted[0]
        assert table == "audit_logs"
        assert row == {"action": "review_submit", "user_id": "u-2", "candidate_uuid": "c-1",
                       "ip_address": "203.0.113.9", "user_agent": "Mozilla", "details": {"decision": "approved"}}

    def test_a_database_error_is_swallowed_never_raised(self):
        client = MagicMock()
        client.table.side_effect = RuntimeError("db down")
        assert AuditRecorder(client).record_sync(audit.LOGIN_PASSWORD) is False

    def test_disabled_recorder_writes_nothing(self):
        client = _client({})
        assert AuditRecorder(client, enabled=False).record_sync(audit.LOGIN_PASSWORD) is False
        assert client._inserted == []

    def test_under_pytest_the_dependency_hands_out_a_disabled_recorder(self):
        # Bộ test chạy với .env thật; không chặn thì mỗi lần chạy test là vài
        # chục dòng rác vào audit_logs của Supabase.
        assert get_audit_recorder(settings=MagicMock()).enabled is False

    def test_client_context_prefers_the_forwarded_ip_behind_the_proxy(self):
        request = SimpleNamespace(
            headers={"x-forwarded-for": "198.51.100.7, 10.0.0.1", "user-agent": "UA/1"},
            client=SimpleNamespace(host="10.0.0.1"),
        )
        assert client_context(request) == ("198.51.100.7", "UA/1")
        assert client_context(None) == (None, None)


class TestLlmUsageAccounting:
    def test_the_provider_reports_tokens_with_the_operation_and_user_from_context(self):
        seen = []
        llm_provider.set_usage_sink(seen.append)
        try:
            with llm_provider.llm_context("candidate_qa", "u-1"):
                llm_provider.report_usage(
                    "openai/gpt-oss-20b",
                    SimpleNamespace(prompt_tokens=120, completion_tokens=30, total_tokens=150),
                    provider="groq",
                )
        finally:
            llm_provider.set_usage_sink(None)
        assert seen == [{"provider": "groq", "model": "openai/gpt-oss-20b", "prompt_tokens": 120,
                         "completion_tokens": 30, "total_tokens": 150, "operation": "candidate_qa", "user_id": "u-1"}]

    def test_gemini_style_usage_metadata_is_understood_too(self):
        seen = []
        llm_provider.set_usage_sink(seen.append)
        try:
            llm_provider.report_usage("gemini-2.0-flash", SimpleNamespace(prompt_token_count=10, candidates_token_count=5, total_token_count=15), provider="gemini")
        finally:
            llm_provider.set_usage_sink(None)
        assert seen[0]["prompt_tokens"] == 10 and seen[0]["completion_tokens"] == 5

    def test_no_sink_means_no_error(self):
        llm_provider.set_usage_sink(None)
        llm_provider.report_usage("x", SimpleNamespace(prompt_tokens=1, completion_tokens=1, total_tokens=2))

    def test_cost_is_estimated_only_for_models_with_a_known_price(self):
        assert estimate_cost("openai/gpt-oss-20b", 1_000_000, 1_000_000) == pytest.approx(0.375)
        # Model không có trong bảng giá: NULL, không phải 0 giả.
        assert estimate_cost("Qwen/Qwen2.5-72B-Instruct", 100, 100) is None

    def test_the_supabase_sink_is_silent_under_pytest(self, monkeypatch):
        called = []
        monkeypatch.setattr("modules.shared.infrastructure.llm_usage.get_supabase_client", lambda *a, **k: called.append(1))
        make_supabase_usage_sink(MagicMock())({"model": "m", "prompt_tokens": 1, "completion_tokens": 1})
        assert called == []
