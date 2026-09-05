"""`POST /api/search/find` — tìm kiếm lai, cùng luật phạm vi và che PII với `/api/search`.

Bản đầu của endpoint này (nhánh fix-integrate-agent) quét cả bảng `candidates`
và trả tên, email, số điện thoại của mọi ứng viên cho bất kỳ HR nào.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from apps.main import app
from modules.auth.domain.models import AuthUser
from modules.search.adapters.routes import get_find_candidate_service, get_search_scope
from modules.shared.infrastructure.auth_dependencies import get_current_user
from src.backend.app.dtos.find_candidate import FindCandidateResult


class FakeScope:
    def __init__(self) -> None:
        self.owners = {"job-1": "u-1"}
        self.panels = {"tl-on": ["job-1"]}
        self.candidate_jobs = {"cand-1": "job-1", "cand-2": "job-1", "cand-x": "job-other"}

    def job_postings_created_by(self, user_id):
        return [j for j, o in self.owners.items() if o == user_id]

    def job_postings_for_reviewer(self, reviewer_id):
        return list(self.panels.get(reviewer_id, []))

    def candidates_for_job_postings(self, job_posting_ids):
        allowed = set(job_posting_ids)
        return sorted(c for c, j in self.candidate_jobs.items() if j in allowed)


class FakeFindService:
    """Ghi lại phạm vi nhận được; trả về đúng những ứng viên trong phạm vi."""

    def __init__(self) -> None:
        self.calls: list = []
        self.rows = {
            "cand-1": FindCandidateResult(candidate_uuid="cand-1", overall_score=0.9, lexical_score=1.0, semantic_score=0.8,
                                          full_name="Trần Bảo", email="bao@example.com", phone="0900", skills=["Python"]),
            "cand-2": FindCandidateResult(candidate_uuid="cand-2", overall_score=0.5, lexical_score=0.4, semantic_score=0.6,
                                          full_name="Lê An", email="an@example.com", phone=None, skills=["Go"]),
            "cand-x": FindCandidateResult(candidate_uuid="cand-x", overall_score=0.95, lexical_score=1.0, semantic_score=0.9,
                                          full_name="Người Khác", email="x@other.com", phone="0911", skills=["Python"]),
        }

    async def find(self, request, scope_candidate_ids=None):
        self.calls.append(scope_candidate_ids)
        if scope_candidate_ids is None:
            return list(self.rows.values())
        return [self.rows[c] for c in scope_candidate_ids if c in self.rows]


@pytest.fixture(autouse=True)
def deps():
    scope, svc = FakeScope(), FakeFindService()
    app.dependency_overrides[get_search_scope] = lambda: scope
    app.dependency_overrides[get_find_candidate_service] = lambda: svc
    yield scope, svc
    app.dependency_overrides.pop(get_search_scope, None)
    app.dependency_overrides.pop(get_find_candidate_service, None)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def sign_in():
    def _apply(role: str, user_id: str = "u-1") -> None:
        app.dependency_overrides[get_current_user] = lambda: AuthUser(
            id=user_id, email=f"{role}@smartats.com", name=role.upper(), role=role
        )

    yield _apply
    app.dependency_overrides.pop(get_current_user, None)


QUERY = {"role_description": "Senior Python backend engineer", "top_k": 10}


class TestScoping:
    def test_hr_only_finds_candidates_who_applied_to_their_postings(self, client, sign_in, deps):
        sign_in("hr")
        body = client.post("/api/search/find", json=QUERY).json()
        assert [r["candidate_uuid"] for r in body] == ["cand-1", "cand-2"]
        # Phạm vi đi vào service như bộ lọc cứng, không phải lọc sau top-k.
        assert deps[1].calls == [["cand-1", "cand-2"]]

    def test_a_tech_lead_is_scoped_by_their_panel(self, client, sign_in):
        sign_in("tech_lead", user_id="tl-on")
        assert [r["candidate_uuid"] for r in client.post("/api/search/find", json=QUERY).json()] == ["cand-1", "cand-2"]

    def test_someone_with_no_postings_gets_an_empty_list_not_everyone(self, client, sign_in, deps):
        sign_in("hr", user_id="u-new")
        assert client.post("/api/search/find", json=QUERY).json() == []
        sign_in("tech_lead", user_id="tl-off")
        assert client.post("/api/search/find", json=QUERY).json() == []
        # Không có gì để tìm thì không gọi service (không nạp mô hình, không gọi DB).
        assert deps[1].calls == []


class TestMasking:
    def test_hr_sees_identity_and_contact(self, client, sign_in):
        sign_in("hr")
        top = client.post("/api/search/find", json=QUERY).json()[0]
        assert top["full_name"] == "Trần Bảo" and top["email"] == "bao@example.com" and top["phone"] == "0900"

    def test_a_tech_lead_keeps_the_scores_and_skills_but_not_the_person(self, client, sign_in):
        sign_in("tech_lead", user_id="tl-on")
        top = client.post("/api/search/find", json=QUERY).json()[0]
        assert top["full_name"] == "***" and top["email"] == "***" and top["phone"] == "***"
        assert top["overall_score"] == 0.9 and top["lexical_score"] == 1.0 and top["semantic_score"] == 0.8
        assert top["skills"] == ["Python"]


class TestAccess:
    def test_it_requires_a_token(self, client):
        assert client.post("/api/search/find", json=QUERY).status_code == 401

    def test_admin_may_not(self, client, sign_in):
        sign_in("admin")
        assert client.post("/api/search/find", json=QUERY).status_code == 403
