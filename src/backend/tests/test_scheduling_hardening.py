"""Bốn chỗ không ổn trong bản mở rộng trang lịch, và hành vi phải giữ.

1. Không có route đặt "API key" tay: backend gửi giá trị đó làm Bearer, Google
   trả 401 lúc đọc lịch trong khi giao diện đã báo "đã kết nối".
2. Không gợi ý giờ đã qua: bản dựng khung giờ theo ngày làm việc bỏ mất
   `max(start, now)`.
3. `duration_minutes` / `limit` có biên: số âm từng đi thẳng vào sweep-line.
4. Danh sách người phỏng vấn của HR hỏi hội đồng MỘT lần, không phải mỗi tin
   một `get_panel` (~160 ms mỗi vòng từ Azure).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from apps.main import app
from modules.auth.domain.models import AuthUser
from modules.review.adapters.routes import get_review_repo
from modules.scheduling.adapters.routes import _build_oauth_service, _build_service
from modules.scheduling.application.scheduling_service import clip_to_future
from modules.scheduling.domain.models import FreeBusyInterval, Interviewer
from modules.shared.infrastructure.auth_dependencies import get_current_user
from modules.shared.infrastructure.supabase_client import get_supabase_admin_client

NOW = datetime(2026, 9, 7, 8, 0, tzinfo=timezone.utc)  # 15:00 giờ Việt Nam


def _fb(iid, start, end):
    return FreeBusyInterval(interviewer_id=iid, start_time=start, end_time=end)


class TestClipToFuture:
    def test_a_window_that_started_earlier_today_begins_now(self):
        out = clip_to_future({"a": [_fb("a", NOW - timedelta(hours=6), NOW + timedelta(hours=2))]}, NOW)
        assert out["a"][0].start_time == NOW and out["a"][0].end_time == NOW + timedelta(hours=2)

    def test_a_window_entirely_in_the_past_is_dropped(self):
        out = clip_to_future({"a": [_fb("a", NOW - timedelta(hours=6), NOW - timedelta(hours=1))]}, NOW)
        assert out == {"a": []}

    def test_future_windows_are_untouched(self):
        fb = _fb("a", NOW + timedelta(days=1), NOW + timedelta(days=1, hours=8))
        assert clip_to_future({"a": [fb]}, NOW) == {"a": [fb]}


# ---------------------------------------------------------------------------
# Route-level
# ---------------------------------------------------------------------------
HR = AuthUser(id="hr-1", email="hr@smartats.com", name="HR", role="hr")


class FakeReviewRepo:
    def __init__(self):
        self.get_panel_calls = 0
        self.batch_calls: list[list[str]] = []

    async def job_postings_created_by(self, user_id):
        return ["job-1", "job-2", "job-3"]

    async def reviewers_for_job_postings(self, job_posting_ids):
        self.batch_calls.append(list(job_posting_ids))
        return {"tl-1", "tl-2"}

    async def get_panel(self, job_posting_id):
        self.get_panel_calls += 1
        raise AssertionError("hội đồng phải được hỏi theo lô, không phải theo từng tin")

    async def job_posting_of_candidate(self, candidate_uuid):
        return None


def _interviewer(iid, key="tok"):
    return Interviewer(id=iid, name=iid, email=f"{iid}@x.y", role="tech_lead", initials="TL", color="#000", calendar_api_key=key)


@pytest.fixture
def deps():
    repo = FakeReviewRepo()
    service = MagicMock()
    service.list_interviewers = AsyncMock(return_value=[_interviewer("tl-1"), _interviewer("tl-2"), _interviewer("tl-other"), _interviewer("hr-1")])
    service.get_interviewer = AsyncMock(return_value=None)
    supabase = MagicMock()
    supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"company_name": None}])
    app.dependency_overrides[get_review_repo] = lambda: repo
    app.dependency_overrides[_build_service] = lambda: service
    app.dependency_overrides[_build_oauth_service] = lambda: MagicMock()
    app.dependency_overrides[get_supabase_admin_client] = lambda: supabase
    app.dependency_overrides[get_current_user] = lambda: HR
    yield repo, service
    for dep in (get_review_repo, _build_service, _build_oauth_service, get_supabase_admin_client, get_current_user):
        app.dependency_overrides.pop(dep, None)


@pytest.fixture
def client():
    return TestClient(app)


class TestConnectedInterviewersForHr:
    def test_panels_are_fetched_in_one_batch_and_only_panel_members_are_offered(self, client, deps):
        repo, _ = deps
        r = client.get("/api/scheduling/connected-interviewers")
        assert r.status_code == 200, r.text
        assert sorted(iv["id"] for iv in r.json()) == ["hr-1", "tl-1", "tl-2"]
        assert repo.batch_calls == [["job-1", "job-2", "job-3"]]
        assert repo.get_panel_calls == 0


class TestSlotRequestBounds:
    @pytest.mark.parametrize("payload", [
        {"duration_minutes": -30},
        {"duration_minutes": 5},
        {"duration_minutes": 600},
        {"limit": -1},
        {"limit": 1000},
    ])
    def test_out_of_range_values_are_rejected_before_reaching_the_sweep(self, client, deps, payload):
        body = {"interviewer_ids": ["tl-1"], "date_from": "2026-09-08T00:00:00+00:00", "date_to": "2026-09-09T00:00:00+00:00", **payload}
        assert client.post("/api/scheduling/slots", json=body).status_code == 422


class TestNoManualApiKey:
    def test_the_calendar_key_route_is_gone(self, client, deps):
        assert client.post("/api/scheduling/calendar-key", json={"api_key": "AIza-fake"}).status_code in (404, 405)
