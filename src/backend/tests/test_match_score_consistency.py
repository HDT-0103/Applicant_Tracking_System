"""Điểm khớp phải là MỘT con số ở mọi màn hình.

Cột `enrichment_profiles.match_confidence_score` có hai người ghi: pipeline CV
(cosine với tin, ~85) và enrichment worker (đếm từ khoá GitHub/LinkedIn, hay
chạm trần 99). `persist_analytics` gộp và để pipeline thắng — nhưng worker
từng giữ trong bộ nhớ bản CHƯA gộp, nên trang hồ sơ (đọc bộ nhớ) hiện 99 trong
khi dashboard (đọc DB) hiện 85, cho tới khi backend restart.
"""
from __future__ import annotations

from unittest.mock import MagicMock

from modules.enrichment.application.enrichment_service import (
    apply_persisted_analytics,
    persist_analytics,
)
from modules.enrichment.domain.models import EnrichedProfile, MockAnalytics, TechnicalSkillMatrix


def _profile(score=99.0, increase=19.2):
    return EnrichedProfile(
        analytics=MockAnalytics(
            match_confidence_score=score,
            score_increase=increase,
            semantic_tags=["#python"],
            technical_skill_matrix=TechnicalSkillMatrix(pre_enrichment=[1, 2], post_enrichment=[3, 4]),
        )
    )


class TestApplyPersisted:
    def test_memory_takes_the_pipeline_score_and_breakdown_that_won_on_disk(self):
        persisted = {
            "match_confidence_score": 85.19,
            "score_increase": 0.29,
            "semantic_tags": ["#python", "FastAPI"],
            "skill_matrix": {"must_have": {"matched": ["Python"], "missing": []}, "pre_enrichment": [1, 2], "post_enrichment": [3, 4]},
        }
        synced = apply_persisted_analytics(_profile(), persisted)
        assert synced.analytics.match_confidence_score == 85.19
        assert synced.analytics.score_increase == 0.29
        assert synced.analytics.semantic_tags == ["#python", "FastAPI"]
        assert synced.skill_matrix["must_have"]["matched"] == ["Python"]
        # Radar không mất.
        assert synced.analytics.technical_skill_matrix.post_enrichment == [3, 4]

    def test_without_a_pipeline_breakdown_the_keyword_score_stays(self):
        persisted = {"match_confidence_score": 99.0, "score_increase": 19.2, "semantic_tags": ["#python"],
                     "skill_matrix": {"pre_enrichment": [1, 2], "post_enrichment": [3, 4]}}
        synced = apply_persisted_analytics(_profile(), persisted)
        assert synced.analytics.match_confidence_score == 99.0 and synced.skill_matrix is None

    def test_a_failed_persist_leaves_memory_untouched(self):
        profile = _profile()
        assert apply_persisted_analytics(profile, None) is profile


class TestPersistReturnsWhatItWrote:
    def _client(self, existing_row):
        client = MagicMock()
        builder = MagicMock()
        for m in ("select", "eq", "limit", "update", "insert"):
            getattr(builder, m).return_value = builder
        # Thứ tự execute(): select hàng cũ → update (rỗng nếu chưa có hàng) → insert.
        builder.execute.side_effect = (
            [MagicMock(data=[existing_row]), MagicMock(data=[{"id": 1}])]
            if existing_row
            else [MagicMock(data=[]), MagicMock(data=[]), MagicMock(data=[{"id": 1}])]
        )
        client.table.return_value = builder
        return client, builder

    def test_the_pipeline_score_wins_and_is_returned(self, monkeypatch):
        client, builder = self._client({
            "skill_matrix": {"must_have": {"matched": ["Python"], "missing": ["Go"]}},
            "match_confidence_score": 85.19, "score_increase": 0.29, "semantic_tags": ["FastAPI"],
        })
        monkeypatch.setattr("modules.enrichment.application.enrichment_service.get_supabase_client", lambda *a, **k: client)
        persisted = persist_analytics("c-1", _profile().analytics, settings=MagicMock())
        assert persisted["match_confidence_score"] == 85.19 and persisted["score_increase"] == 0.29
        assert persisted["skill_matrix"]["must_have"]["missing"] == ["Go"]
        assert persisted["skill_matrix"]["post_enrichment"] == [3, 4]
        assert persisted["semantic_tags"] == ["#python", "FastAPI"]
        # Và đúng payload đó được ghi.
        builder.update.assert_called_once_with(persisted)

    def test_no_row_yet_means_the_keyword_score_is_written_and_returned(self, monkeypatch):
        client, builder = self._client(None)
        monkeypatch.setattr("modules.enrichment.application.enrichment_service.get_supabase_client", lambda *a, **k: client)
        persisted = persist_analytics("c-1", _profile().analytics, settings=MagicMock())
        assert persisted["match_confidence_score"] == 99.0
        builder.insert.assert_called_once()
