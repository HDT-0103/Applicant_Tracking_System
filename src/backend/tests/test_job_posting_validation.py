"""
Server-side guard that keeps a CV on the job it was submitted for.

The public form sends job_id as multipart form data, so it is client-controlled;
these tests pin the behaviour of the check that runs before anything is stored.
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from modules.ingestion.adapters import azure_routes


class _FakeQuery:
    def __init__(self, rows, raises=None):
        self._rows = rows
        self._raises = raises

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        if self._raises:
            raise self._raises
        return type("Response", (), {"data": self._rows})()


class _FakeClient:
    def __init__(self, rows, raises=None):
        self._rows = rows
        self._raises = raises
        self.requested_table = None

    def table(self, name):
        self.requested_table = name
        return _FakeQuery(self._rows, self._raises)


@pytest.fixture
def settings():
    return object()


def _patch_client(monkeypatch, client):
    monkeypatch.setattr(azure_routes, "get_supabase_client", lambda *_a, **_k: client)


def _iso(offset: timedelta) -> str:
    return (datetime.now(timezone.utc) + offset).isoformat()


def test_published_job_is_accepted(monkeypatch, settings):
    client = _FakeClient([{"id": "job-1", "status": "PUBLISHED", "expires_at": None}])
    _patch_client(monkeypatch, client)

    azure_routes._assert_job_accepts_applications("job-1", settings)

    assert client.requested_table == "jobs_posting"


def test_unknown_job_is_rejected(monkeypatch, settings):
    _patch_client(monkeypatch, _FakeClient([]))

    with pytest.raises(HTTPException) as exc:
        azure_routes._assert_job_accepts_applications("missing", settings)

    assert exc.value.status_code == 400
    assert "no longer exists" in exc.value.detail


@pytest.mark.parametrize("job_status", ["DRAFT", "CLOSED", "ARCHIVED"])
def test_unpublished_job_is_rejected(monkeypatch, settings, job_status):
    _patch_client(monkeypatch, _FakeClient([{"id": "job-1", "status": job_status, "expires_at": None}]))

    with pytest.raises(HTTPException) as exc:
        azure_routes._assert_job_accepts_applications("job-1", settings)

    assert exc.value.status_code == 400
    assert "not accepting applications" in exc.value.detail


def test_expired_job_is_rejected(monkeypatch, settings):
    _patch_client(
        monkeypatch,
        _FakeClient([{"id": "job-1", "status": "PUBLISHED", "expires_at": _iso(timedelta(days=-1))}]),
    )

    with pytest.raises(HTTPException) as exc:
        azure_routes._assert_job_accepts_applications("job-1", settings)

    assert exc.value.status_code == 400
    assert "closed" in exc.value.detail


def test_future_deadline_is_accepted(monkeypatch, settings):
    _patch_client(
        monkeypatch,
        _FakeClient([{"id": "job-1", "status": "PUBLISHED", "expires_at": _iso(timedelta(days=7))}]),
    )

    azure_routes._assert_job_accepts_applications("job-1", settings)


def test_naive_expiry_is_treated_as_utc(monkeypatch, settings):
    """Postgres can hand back a timestamp without an offset; it must not crash."""
    naive_past = (datetime.now(timezone.utc) - timedelta(days=1)).replace(tzinfo=None).isoformat()
    _patch_client(monkeypatch, _FakeClient([{"id": "job-1", "status": "PUBLISHED", "expires_at": naive_past}]))

    with pytest.raises(HTTPException):
        azure_routes._assert_job_accepts_applications("job-1", settings)


def test_zulu_suffix_is_parsed(monkeypatch, settings):
    zulu_past = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    _patch_client(monkeypatch, _FakeClient([{"id": "job-1", "status": "PUBLISHED", "expires_at": zulu_past}]))

    with pytest.raises(HTTPException):
        azure_routes._assert_job_accepts_applications("job-1", settings)


def test_unparseable_expiry_does_not_block_the_applicant(monkeypatch, settings):
    _patch_client(monkeypatch, _FakeClient([{"id": "job-1", "status": "PUBLISHED", "expires_at": "not-a-date"}]))

    azure_routes._assert_job_accepts_applications("job-1", settings)


def test_query_failure_surfaces_as_bad_request(monkeypatch, settings):
    _patch_client(monkeypatch, _FakeClient([], raises=RuntimeError("network down")))

    with pytest.raises(HTTPException) as exc:
        azure_routes._assert_job_accepts_applications("job-1", settings)

    assert exc.value.status_code == 400


def test_missing_supabase_config_skips_the_check(monkeypatch, settings):
    """Local dev without credentials must not block every upload."""
    _patch_client(monkeypatch, None)

    azure_routes._assert_job_accepts_applications("job-1", settings)
