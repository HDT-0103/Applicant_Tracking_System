"""HTTP contract for /api/v1/jobs/{job_id}/embeddings.

The route's own logic is entirely error translation: it turns four different
failure modes from the embedding layer into four different HTTP statuses. That
mapping is what these tests pin, because getting it wrong sends the caller
chasing the wrong problem — a missing job reported as a server fault, or a
model that failed to load reported as bad input.

`ensure_job_embeddings` is patched out: it loads a sentence-transformer model
and writes to Supabase, neither of which belongs in a route test.
"""
from __future__ import annotations

import uuid as _uuid
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

from apps.main import app
from modules.auth.domain.models import AuthUser
from modules.scoring.adapters import routes as scoring_routes
from modules.scoring.application.job_embedding_service import JobNotFoundError
from modules.shared.infrastructure.auth_dependencies import get_current_user

JOB_ID = "job-42"


def _user(role: str) -> AuthUser:
    return AuthUser(
        id=str(_uuid.uuid4()),
        email=f"{role}@smartats.com",
        name=role.upper(),
        role=role,
    )


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def as_role():
    def _apply(role: str) -> None:
        app.dependency_overrides[get_current_user] = lambda: _user(role)

    yield _apply
    app.dependency_overrides.pop(get_current_user, None)


class _Result(SimpleNamespace):
    """Stand-in for whatever `ensure_job_embeddings` returns.

    The route reads attributes off it, so a dict will not do.
    """


@pytest.fixture
def embedding_result(monkeypatch):
    """Replace the embedding call with a stub whose behaviour a test chooses."""

    def _set(outcome):
        async def _fake(job_id, settings, force=False):
            if isinstance(outcome, Exception):
                raise outcome
            return _Result(job_posting_id=job_id, **outcome)

        monkeypatch.setattr(scoring_routes, "ensure_job_embeddings", _fake)

    return _set


OK = {"model_name": "intfloat/e5-base", "embedded": ["summary"], "skipped": False}


# ---------------------------------------------------------------------------
# Permissions
# ---------------------------------------------------------------------------

class TestPermissions:
    def test_requires_authentication(self, client):
        assert client.post(f"/api/v1/jobs/{JOB_ID}/embeddings").status_code == 401

    def test_hr_may_embed(self, client, as_role, embedding_result):
        as_role("hr")
        embedding_result(OK)
        assert client.post(f"/api/v1/jobs/{JOB_ID}/embeddings").status_code == 200

    @pytest.mark.parametrize("role", ["tech_lead", "admin"])
    def test_other_roles_may_not_embed(self, client, as_role, embedding_result, role):
        # Embedding rewrites the vectors a posting is matched against, so it is
        # an authoring action — it belongs with whoever owns the job posting.
        as_role(role)
        embedding_result(OK)
        assert client.post(f"/api/v1/jobs/{JOB_ID}/embeddings").status_code == 403


# ---------------------------------------------------------------------------
# Failure mapping
# ---------------------------------------------------------------------------

class TestFailureMapping:
    def test_unknown_job_is_404_not_500(self, client, as_role, embedding_result):
        as_role("hr")
        embedding_result(JobNotFoundError("no such job"))
        r = client.post(f"/api/v1/jobs/{JOB_ID}/embeddings")
        assert r.status_code == 404
        assert "not found" in r.json()["detail"].lower()

    def test_model_unavailable_is_503(self, client, as_role, embedding_result):
        # 503 tells the caller to retry later. A 500 would suggest a bug and a
        # 400 would suggest their request was wrong; neither is true.
        as_role("hr")
        embedding_result(RuntimeError("model failed to load"))
        assert client.post(f"/api/v1/jobs/{JOB_ID}/embeddings").status_code == 503

    def test_database_error_does_not_leak_internals(self, client, as_role, embedding_result):
        as_role("hr")
        embedding_result(APIError({"message": "relation does not exist", "code": "42P01"}))
        r = client.post(f"/api/v1/jobs/{JOB_ID}/embeddings")
        assert r.status_code >= 400
        # The raw PostgREST message names tables and columns; that is internal
        # schema detail and does not belong in an HTTP response body.
        assert "relation does not exist" not in r.text


# ---------------------------------------------------------------------------
# Request handling
# ---------------------------------------------------------------------------

class TestRequestHandling:
    def test_body_is_optional(self, client, as_role, embedding_result):
        as_role("hr")
        embedding_result(OK)
        assert client.post(f"/api/v1/jobs/{JOB_ID}/embeddings").status_code == 200

    def test_force_flag_is_accepted(self, client, as_role, embedding_result):
        as_role("hr")
        embedding_result(OK)
        r = client.post(f"/api/v1/jobs/{JOB_ID}/embeddings", json={"force": True})
        assert r.status_code == 200

    def test_response_echoes_the_job_id(self, client, as_role, embedding_result):
        as_role("hr")
        embedding_result(OK)
        body = client.post(f"/api/v1/jobs/{JOB_ID}/embeddings").json()
        assert body["job_posting_id"] == JOB_ID
        assert body["skipped"] is False

    def test_unchanged_job_reports_skipped(self, client, as_role, embedding_result):
        """Idempotency is the point: re-running must not re-embed."""
        as_role("hr")
        embedding_result({**OK, "embedded": [], "skipped": True})
        body = client.post(f"/api/v1/jobs/{JOB_ID}/embeddings").json()
        assert body["skipped"] is True
        assert body["embedded"] == []
