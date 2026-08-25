"""HTTP contract for /api/review.

Runs with no database: `get_current_user` is overridden, and the review module
already builds itself on an in-memory repository.

Most of what matters at this layer is the permission matrix. The rule the code
encodes is subtle enough to be worth pinning down: `hr` and `tech_lead` both
review a candidate, but only `hr` may break the tie when they disagree.
"""
from __future__ import annotations

import uuid as _uuid

import pytest
from fastapi.testclient import TestClient

from apps.main import app
from modules.auth.domain.models import AuthUser
from modules.shared.infrastructure.auth_dependencies import get_current_user


def _user(role: str) -> AuthUser:
    return AuthUser(
        id=str(_uuid.uuid4()),
        email=f"{role}@smartats.com",
        name=role.upper(),
        role=role,
    )


@pytest.fixture(autouse=True)
def isolated_review_store(tmp_path, monkeypatch):
    """Point the review store at a throwaway file.

    Despite the name, `InMemoryReviewRepo` persists to
    `src/backend/stored_data/reviews.json` — a file that is tracked in git.
    Without this fixture the tests would read whatever decisions happen to be
    committed, and would write candidate review data back into the repository.

    It also makes the tests order-independent: shared state meant a test that
    submitted a Tech Lead review changed the outcome of a later HR test.
    """
    from modules.review.infra import impl_inmemory

    monkeypatch.setattr(
        impl_inmemory, "STORAGE_PATH", str(tmp_path / "reviews.json")
    )
    monkeypatch.setattr(impl_inmemory, "STORAGE_DIR", str(tmp_path))


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def as_role():
    """Sign the caller in as a given role for the duration of one test."""

    def _apply(role: str) -> None:
        app.dependency_overrides[get_current_user] = lambda: _user(role)

    yield _apply
    app.dependency_overrides.pop(get_current_user, None)


CANDIDATE = "11111111-2222-3333-4444-555555555555"


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

class TestAuthentication:
    def test_submit_requires_a_token(self, client):
        r = client.post(f"/api/review/{CANDIDATE}", json={"decision": "approved"})
        assert r.status_code == 401

    def test_read_requires_a_token(self, client):
        assert client.get(f"/api/review/{CANDIDATE}").status_code == 401

    def test_resolve_requires_a_token(self, client):
        r = client.post(
            f"/api/review/{CANDIDATE}/resolve", json={"final_decision": "approved"}
        )
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Permission matrix
# ---------------------------------------------------------------------------

class TestPermissions:
    def test_tech_lead_may_submit(self, client, as_role):
        as_role("tech_lead")
        r = client.post(
            f"/api/review/{CANDIDATE}",
            json={"decision": "approved", "review_text": "Strong profile"},
        )
        assert r.status_code == 200, r.text

    def test_admin_may_not_submit(self, client, as_role):
        # admin administers the system; reviewing candidates is not their job,
        # and the data is masked from them for the same reason.
        as_role("admin")
        r = client.post(f"/api/review/{CANDIDATE}", json={"decision": "approved"})
        assert r.status_code == 403

    @pytest.mark.parametrize("role", ["hr", "tech_lead"])
    def test_operational_roles_may_read_status(self, client, as_role, role):
        as_role(role)
        assert client.get(f"/api/review/{CANDIDATE}").status_code == 200

    def test_only_hr_may_resolve_a_conflict(self, client, as_role):
        """Breaking a tie between HR and Tech Lead is HR's call alone.

        Letting tech_lead resolve would let one side of a disagreement declare
        itself the winner.
        """
        as_role("hr")
        assert (
            client.post(
                f"/api/review/{CANDIDATE}/resolve", json={"final_decision": "approved"}
            ).status_code
            == 200
        )

        as_role("tech_lead")
        assert (
            client.post(
                f"/api/review/{CANDIDATE}/resolve", json={"final_decision": "approved"}
            ).status_code
            == 403
        )


# ---------------------------------------------------------------------------
# Review ordering
# ---------------------------------------------------------------------------

class TestReviewOrdering:
    """Tech Lead reviews first; HR cannot pre-empt the technical assessment.

    The ordering is the point of having two reviewers: if HR could record a
    decision first, the technical review becomes a rubber stamp on a call that
    has already been made.
    """

    def test_hr_cannot_review_before_tech_lead(self, client, as_role):
        as_role("hr")
        r = client.post(f"/api/review/{CANDIDATE}", json={"decision": "approved"})
        assert r.status_code == 400
        assert "Tech Lead" in r.json()["detail"]

    def test_the_rejection_names_what_to_do_next(self, client, as_role):
        # An error a recruiter reads mid-task has to say who acts next, not
        # just that something was refused.
        as_role("hr")
        detail = client.post(
            f"/api/review/{CANDIDATE}", json={"decision": "approved"}
        ).json()["detail"]
        assert "first" in detail.lower()


# ---------------------------------------------------------------------------
# Request validation
# ---------------------------------------------------------------------------

class TestValidation:
    def test_decision_outside_the_allowed_set_is_rejected(self, client, as_role):
        as_role("tech_lead")
        r = client.post(f"/api/review/{CANDIDATE}", json={"decision": "maybe"})
        assert r.status_code in (400, 422)

    def test_missing_decision_is_rejected(self, client, as_role):
        as_role("tech_lead")
        assert client.post(f"/api/review/{CANDIDATE}", json={}).status_code == 422

    def test_review_text_is_optional(self, client, as_role):
        as_role("tech_lead")
        r = client.post(f"/api/review/{CANDIDATE}", json={"decision": "rejected"})
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# Response shape
# ---------------------------------------------------------------------------

class TestResponseShape:
    def test_status_response_names_the_candidate(self, client, as_role):
        as_role("hr")
        body = client.get(f"/api/review/{CANDIDATE}").json()
        assert body["candidate_uuid"] == CANDIDATE

    def test_unreviewed_candidate_returns_a_status_not_a_404(self, client, as_role):
        # "nobody has reviewed this yet" is a valid state, not a missing
        # resource — the UI renders an empty review panel from it.
        as_role("hr")
        assert client.get(f"/api/review/{_uuid.uuid4()}").status_code == 200
