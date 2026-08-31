"""Đường đọc dữ liệu danh sách.

Module `catalog` sinh ra để gỡ một thế kẹt: trình duyệt hỏi thẳng PostgREST
bằng anon key, nên tắt RLS thì ai cũng đọc được cả bảng, mà bật RLS thì màn
hình chết (Supabase không giải mã được JWT của ứng dụng). Những test dưới đây
giữ hai điều mà việc chuyển sang backend phải đổi lấy: lọc theo hội đồng, và
che PII theo role.
"""
from __future__ import annotations

import uuid as _uuid

import pytest
from fastapi.testclient import TestClient

from apps.main import app
from modules.auth.domain.models import AuthUser
from modules.catalog.adapters.routes import get_catalog_repo
from modules.catalog.domain.models import (
    CandidateCard,
    CandidateOption,
    ConfirmedSlotSummary,
    JobPostingSummary,
)
from modules.shared.infrastructure.auth_dependencies import get_current_user

JOB_MINE = "job-mine"
JOB_THEIRS = "job-theirs"


def _card(uuid: str, name: str, job: str) -> CandidateCard:
    return CandidateCard(
        candidate_uuid=uuid,
        full_name=name,
        email=f"{uuid}@example.com",
        current_company="Acme",
        job_posting_id=job,
        match_confidence_score=88.5,
    )


class FakeCatalogRepo:
    def __init__(self) -> None:
        self.cards = [
            _card("cand-1", "Trần Bảo", JOB_MINE),
            _card("cand-2", "Lê An", JOB_THEIRS),
        ]
        self.slots = [
            ConfirmedSlotSummary(id="s1", candidate_uuid="cand-1", start_time="2026-09-01T02:30:00Z"),
            ConfirmedSlotSummary(id="s2", candidate_uuid="cand-2", start_time="2026-09-02T02:30:00Z"),
        ]
        self.panels = {"tl-on": [JOB_MINE], "tl-off": []}
        self.deleted: list[str] = []

    def job_postings_for_reviewer(self, reviewer_id):
        return self.panels.get(reviewer_id, [])

    def list_candidate_cards(self, limit, job_posting_ids=None):
        if job_posting_ids is None:
            return list(self.cards)
        allowed = set(job_posting_ids)
        return [c for c in self.cards if c.job_posting_id in allowed]

    def list_candidate_options(self, limit, job_posting_ids=None):
        return [
            CandidateOption(candidate_uuid=c.candidate_uuid, full_name=c.full_name)
            for c in self.list_candidate_cards(limit, job_posting_ids)
        ]

    def list_confirmed_slots(self):
        return list(self.slots)

    def list_job_postings(self):
        return [JobPostingSummary(id=JOB_MINE, job_title="Backend", status="PUBLISHED", applicant_count=2)]

    def delete_job_posting(self, job_posting_id):
        self.deleted.append(job_posting_id)

    def read_analytics(self):
        jobs = [{"id": JOB_MINE, "job_title": "Backend"}]
        applications = [{"id": "a1", "job_posting_id": JOB_MINE}]
        candidates = [
            {"uuid": "cand-1", "current_location": "HCMC", "github_username": "octocat", "linkedin_url": None},
            {"uuid": "cand-2", "current_location": "HCMC", "github_username": None, "linkedin_url": "x"},
            {"uuid": "cand-3", "current_location": None, "github_username": None, "linkedin_url": None},
        ]
        return jobs, applications, candidates


@pytest.fixture(autouse=True)
def repo():
    fake = FakeCatalogRepo()
    app.dependency_overrides[get_catalog_repo] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_catalog_repo, None)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sign_in():
    def _apply(role: str, user_id: str = "u-1") -> None:
        app.dependency_overrides[get_current_user] = lambda: AuthUser(
            id=user_id, email=f"{role}@smartats.com", name=role.upper(), role=role
        )

    yield _apply
    app.dependency_overrides.pop(get_current_user, None)


class TestAuthentication:
    @pytest.mark.parametrize(
        "path", ["/api/catalog/dashboard", "/api/catalog/job-postings", "/api/catalog/analytics"]
    )
    def test_every_read_requires_a_token(self, client, path):
        assert client.get(path).status_code == 401

    def test_admin_is_kept_out_of_business_data(self, client, sign_in):
        sign_in("admin")
        assert client.get("/api/catalog/dashboard").status_code == 403


class TestPanelScoping:
    def test_hr_sees_every_candidate(self, client, sign_in):
        sign_in("hr")
        body = client.get("/api/catalog/dashboard").json()
        assert {c["candidate_uuid"] for c in body["candidates"]} == {"cand-1", "cand-2"}

    def test_a_tech_lead_sees_only_their_panel(self, client, sign_in):
        sign_in("tech_lead", user_id="tl-on")
        body = client.get("/api/catalog/dashboard").json()
        assert {c["candidate_uuid"] for c in body["candidates"]} == {"cand-1"}

    def test_a_tech_lead_on_no_panel_sees_nothing(self, client, sign_in):
        sign_in("tech_lead", user_id="tl-off")
        body = client.get("/api/catalog/dashboard").json()
        assert body["candidates"] == []
        assert body["slots"] == []

    def test_slots_follow_the_candidates(self, client, sign_in):
        # Một lịch phỏng vấn gắn với ứng viên mình không được xem vẫn tiết lộ
        # rằng người đó đang phỏng vấn.
        sign_in("tech_lead", user_id="tl-on")
        body = client.get("/api/catalog/dashboard").json()
        assert [s["candidate_uuid"] for s in body["slots"]] == ["cand-1"]

    def test_the_candidate_picker_is_scoped_too(self, client, sign_in):
        sign_in("tech_lead", user_id="tl-on")
        body = client.get("/api/catalog/candidates/options").json()
        assert [c["candidate_uuid"] for c in body] == ["cand-1"]


class TestMasking:
    def test_hr_reads_names_and_emails(self, client, sign_in):
        sign_in("hr")
        card = client.get("/api/catalog/dashboard").json()["candidates"][0]
        assert card["full_name"] == "Trần Bảo"
        assert card["email"] == "cand-1@example.com"

    def test_a_tech_lead_gets_the_identity_masked(self, client, sign_in):
        # Đây chính là luật mà abac.py giữ, và là thứ mà đường đọc thẳng
        # PostgREST đi vòng qua hoàn toàn.
        sign_in("tech_lead", user_id="tl-on")
        card = client.get("/api/catalog/dashboard").json()["candidates"][0]
        assert card["full_name"] == "***"
        assert card["email"] == "***"

    def test_the_technical_signal_survives_masking(self, client, sign_in):
        # Che danh tính mà xoá luôn điểm số thì tech lead không chấm được gì.
        sign_in("tech_lead", user_id="tl-on")
        card = client.get("/api/catalog/dashboard").json()["candidates"][0]
        assert card["match_confidence_score"] == 88.5


class TestJobPostings:
    def test_both_operational_roles_may_list(self, client, sign_in):
        for role in ("hr", "tech_lead"):
            sign_in(role)
            assert client.get("/api/catalog/job-postings").status_code == 200

    def test_only_hr_may_delete(self, client, sign_in, repo):
        sign_in("tech_lead")
        assert client.delete(f"/api/catalog/job-postings/{JOB_MINE}").status_code == 403
        assert repo.deleted == []

        sign_in("hr")
        assert client.delete(f"/api/catalog/job-postings/{JOB_MINE}").status_code == 204
        assert repo.deleted == [JOB_MINE]


class TestAnalytics:
    def test_it_returns_counts_not_identities(self, client, sign_in):
        sign_in("hr")
        body = client.get("/api/catalog/analytics").json()

        assert body["candidate_count"] == 3
        assert body["candidates_with_github"] == 1
        assert body["candidates_with_linkedin"] == 1
        assert body["locations"] == {"HCMC": 2}
        # Màn hình này vẽ số liệu tổng hợp; tên và email không có lý do rời máy chủ.
        assert "candidates" not in body
