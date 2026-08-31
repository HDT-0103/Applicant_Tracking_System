"""Rebuilding a candidate's enrichment from the database.

The status endpoint reads `candidate_enrichments`, a dict held in memory. That
dict is empty after every restart and every worker process keeps its own, so a
miss says nothing about whether the work was actually done. Without a database
fallback a candidate enriched days ago reports QUEUED forever and the UI sits on
a spinner.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from modules.enrichment.application import enrichment_service as svc
from modules.enrichment.domain.models import EnrichmentStatus


def _client_returning(rows: list[dict]) -> MagicMock:
    result = MagicMock()
    result.data = rows
    client = MagicMock()
    client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
        result
    )
    return client


@pytest.fixture
def db_rows(monkeypatch):
    def _set(rows):
        monkeypatch.setattr(
            svc, "get_supabase_client", lambda *_a, **_k: _client_returning(rows)
        )

    return _set


SCORED_ROW = {
    "enrichment_status": "ENRICHED",
    "match_confidence_score": 70,
    "score_increase": 10,
    "semantic_tags": ["#python", "#backend"],
    "skill_matrix": {
        "must_have": {"matched": ["Python"], "missing": ["Go"]},
        "nice_to_have": {"matched": [], "missing": []},
        "extra_skills": ["Terraform"],
    },
}


class TestRebuildFromDatabase:
    def test_returns_an_enriched_profile(self, db_rows):
        db_rows([SCORED_ROW])
        result = svc.load_enrichment_from_db("uuid-1", MagicMock())

        assert result is not None
        assert result.enrichment_status == EnrichmentStatus.ENRICHED
        assert result.enriched_profile.analytics.match_confidence_score == 70

    def test_carries_the_requirement_breakdown(self, db_rows):
        # This is what lets the UI explain a score instead of only stating it.
        db_rows([SCORED_ROW])
        profile = svc.load_enrichment_from_db("uuid-1", MagicMock()).enriched_profile

        assert profile.skill_matrix["must_have"]["matched"] == ["Python"]
        assert profile.skill_matrix["must_have"]["missing"] == ["Go"]

    def test_carries_semantic_tags(self, db_rows):
        db_rows([SCORED_ROW])
        profile = svc.load_enrichment_from_db("uuid-1", MagicMock()).enriched_profile
        assert profile.analytics.semantic_tags == ["#python", "#backend"]


class TestWhenNotToClaimSuccess:
    def test_no_row_at_all(self, db_rows):
        # Nothing has run yet; the caller keeps reporting QUEUED.
        db_rows([])
        assert svc.load_enrichment_from_db("uuid-unknown", MagicMock()) is None

    def test_row_exists_but_was_never_scored(self, db_rows):
        """A half-written row must not be reported as finished.

        Calling this ENRICHED would show the recruiter an empty analytics panel
        as though enrichment had completed successfully.
        """
        db_rows([{**SCORED_ROW, "match_confidence_score": None}])
        assert svc.load_enrichment_from_db("uuid-2", MagicMock()) is None

    def test_database_failure_is_not_reported_as_enriched(self, db_rows, monkeypatch):
        def _boom(*_a, **_k):
            raise RuntimeError("supabase down")

        monkeypatch.setattr(svc, "get_supabase_client", _boom)
        assert svc.load_enrichment_from_db("uuid-3", MagicMock()) is None


class TestMalformedStoredData:
    def test_missing_skill_matrix(self, db_rows):
        db_rows([{**SCORED_ROW, "skill_matrix": None}])
        profile = svc.load_enrichment_from_db("uuid-4", MagicMock()).enriched_profile
        assert profile.skill_matrix is None

    def test_radar_arrays_are_not_mistaken_for_a_breakdown(self, db_rows):
        """`skill_matrix` holds two different shapes depending on the writer.

        The radar arrays (pre/post enrichment) and the requirement breakdown
        share one column. Handing the radar data to the breakdown panel would
        render an empty list of requirements under a confident heading.
        """
        db_rows([
            {**SCORED_ROW, "skill_matrix": {"pre_enrichment": [1.0], "post_enrichment": [2.0]}}
        ])
        profile = svc.load_enrichment_from_db("uuid-5", MagicMock()).enriched_profile

        assert profile.skill_matrix is None
        assert profile.analytics.technical_skill_matrix.post_enrichment == [2.0]

    def test_null_semantic_tags_become_an_empty_list(self, db_rows):
        db_rows([{**SCORED_ROW, "semantic_tags": None}])
        profile = svc.load_enrichment_from_db("uuid-6", MagicMock()).enriched_profile
        assert profile.analytics.semantic_tags == []
