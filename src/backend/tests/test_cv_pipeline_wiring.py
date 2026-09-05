"""Mắt xích nối pipeline CV, vector tin, và hai chỗ từng báo xanh giả.

Pipeline `CVProcessingPipeline` có trên `main` từ lâu mà không ai gọi; các
test ở đây canh việc nó THẬT SỰ được gọi từ luồng upload, và canh thứ tự
(pipeline trước, enrichment sau) vì cả hai ghi cùng một hàng.
"""
from __future__ import annotations

import re
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from modules.catalog.infra.impl_supabase import SupabaseCatalogRepo
from modules.ingestion.adapters import azure_routes
from modules.ingestion.domain.candidate_repository import candidate_store
from modules.ingestion.domain.models import CandidateRecord
from modules.scheduling.infra.calendar_event_service import CalendarEventService
from modules.scoring.application import cv_pipeline
from modules.shared.infrastructure.abac import apply_abac

SETTINGS = object()


class TestPostIngestWorker:
    @pytest.mark.asyncio
    async def test_the_pipeline_runs_before_enrichment_and_both_get_the_candidate(self, monkeypatch):
        order: list[str] = []

        async def fake_pipeline(candidate_uuid, application_id, job_id, settings):
            order.append(f"pipeline:{candidate_uuid}:{application_id}:{job_id}")
            return True

        async def fake_enrichment(candidate_uuid, settings):
            order.append(f"enrichment:{candidate_uuid}")

        monkeypatch.setattr(azure_routes, "run_cv_pipeline", fake_pipeline)
        monkeypatch.setattr(azure_routes, "enrichment_worker", fake_enrichment)

        await azure_routes.post_ingest_worker("cand-1", "app-1", "job-1", SETTINGS)
        assert order == ["pipeline:cand-1:app-1:job-1", "enrichment:cand-1"]

    @pytest.mark.asyncio
    async def test_a_crashing_pipeline_does_not_stop_enrichment(self, monkeypatch):
        seen: list[str] = []

        async def boom(*a, **k):
            raise RuntimeError("LLM down")

        async def fake_enrichment(candidate_uuid, settings):
            seen.append(candidate_uuid)

        monkeypatch.setattr(azure_routes, "run_cv_pipeline", boom)
        monkeypatch.setattr(azure_routes, "enrichment_worker", fake_enrichment)
        await azure_routes.post_ingest_worker("cand-1", None, None, SETTINGS)
        assert seen == ["cand-1"]

    @pytest.mark.asyncio
    async def test_the_upload_route_schedules_the_worker_not_just_enrichment(self):
        # Đường upload là chỗ DUY NHẤT pipeline được gọi; nếu ai đó "đơn giản
        # hoá" về add_task(enrichment_worker) thì mọi thứ ở trên chết lặng.
        src = Path(azure_routes.__file__).read_text()
        assert "background_tasks.add_task(\n            post_ingest_worker," in src
        assert not re.search(r"add_task\(\s*enrichment_worker", src)


class TestRunCvPipeline:
    @pytest.fixture(autouse=True)
    def _clean_store(self):
        candidate_store.clear()
        yield
        candidate_store.clear()

    @pytest.mark.asyncio
    async def test_no_text_means_no_score_and_no_database_call(self, monkeypatch):
        # PDF scan ảnh: không có gì để phân tích. Không được bịa điểm, và không
        # được đụng tới Supabase hay mô hình.
        candidate_store["c1"] = CandidateRecord(uuid="c1", resume_text="   ")
        monkeypatch.setattr(cv_pipeline, "get_supabase_client", lambda *a, **k: pytest.fail("không được gọi DB"))
        assert await cv_pipeline.run_cv_pipeline("c1", "app", "job", SETTINGS) is False

    @pytest.mark.asyncio
    async def test_text_is_handed_to_the_pipeline_with_the_application(self, monkeypatch):
        candidate_store["c1"] = CandidateRecord(uuid="c1", resume_text="Python dev 5 years")
        monkeypatch.setattr(cv_pipeline, "get_supabase_client", lambda *a, **k: object())
        ensured: list[str] = []

        async def fake_ensure(job_id, settings, **kw):
            ensured.append(job_id)

        monkeypatch.setattr(cv_pipeline, "ensure_job_embeddings", fake_ensure)
        pipeline = MagicMock()
        pipeline.process_cv = AsyncMock(return_value=SimpleNamespace(overall_score=0.7))
        monkeypatch.setattr(cv_pipeline, "build_cv_pipeline", lambda client: pipeline)

        assert await cv_pipeline.run_cv_pipeline("c1", "app-1", "job-1", SETTINGS) is True
        assert ensured == ["job-1"]  # tin chưa có vector thì tự lấp trước khi chấm
        kwargs = pipeline.process_cv.await_args.kwargs
        assert kwargs["resume_text"] == "Python dev 5 years"
        assert kwargs["job_posting_id"] == "job-1" and kwargs["application_id"] == "app-1"

    @pytest.mark.asyncio
    async def test_an_internal_upload_without_a_job_still_gets_profile_and_vectors(self, monkeypatch):
        candidate_store["c1"] = CandidateRecord(uuid="c1", resume_text="Go dev")
        monkeypatch.setattr(cv_pipeline, "get_supabase_client", lambda *a, **k: object())
        monkeypatch.setattr(cv_pipeline, "ensure_job_embeddings", AsyncMock(side_effect=AssertionError("không có tin")))
        pipeline = MagicMock(); pipeline.process_cv = AsyncMock(return_value=None)
        monkeypatch.setattr(cv_pipeline, "build_cv_pipeline", lambda client: pipeline)

        assert await cv_pipeline.run_cv_pipeline("c1", None, None, SETTINGS) is True
        kwargs = pipeline.process_cv.await_args.kwargs
        assert kwargs["job_posting_id"] is None and kwargs["application_id"] is None

    @pytest.mark.asyncio
    async def test_a_missing_llm_key_is_logged_not_raised(self, monkeypatch):
        candidate_store["c1"] = CandidateRecord(uuid="c1", resume_text="x")
        monkeypatch.setattr(cv_pipeline, "get_supabase_client", lambda *a, **k: object())
        monkeypatch.setattr(cv_pipeline, "build_cv_pipeline", MagicMock(side_effect=RuntimeError("no key")))
        assert await cv_pipeline.run_cv_pipeline("c1", None, None, SETTINGS) is False


class TestRefreshJobEmbeddings:
    @pytest.mark.asyncio
    async def test_errors_are_logged_not_raised(self, monkeypatch):
        # Là task nền sau response: ném lỗi ở đây chỉ làm bẩn log của uvicorn,
        # không tới được ai.
        monkeypatch.setattr(cv_pipeline, "ensure_job_embeddings", AsyncMock(side_effect=RuntimeError("db down")))
        await cv_pipeline.refresh_job_embeddings("job-1", SETTINGS)


class TestCalendarEventHonesty:
    """`create_event` từng trả uuid giả khi không có token / Google lỗi."""

    @pytest.mark.asyncio
    async def test_no_token_means_no_event(self):
        assert await CalendarEventService().create_event(
            api_key="", summary="s", description="d",
            start_time=MagicMock(), end_time=MagicMock(), attendee_emails=[],
        ) is None

    @pytest.mark.asyncio
    async def test_a_google_error_means_no_event(self):
        response = httpx.Response(500, request=httpx.Request("POST", "https://x"))
        with patch("httpx.AsyncClient.post", AsyncMock(return_value=response)):
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            assert await CalendarEventService().create_event(
                api_key="tok", summary="s", description="d",
                start_time=now, end_time=now, attendee_emails=["a@b.c"],
            ) is None

    @pytest.mark.asyncio
    async def test_an_expired_token_still_surfaces_so_it_can_be_refreshed(self):
        response = httpx.Response(401, request=httpx.Request("POST", "https://x"))
        with patch("httpx.AsyncClient.post", AsyncMock(return_value=response)):
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            with pytest.raises(httpx.HTTPStatusError):
                await CalendarEventService().create_event(
                    api_key="tok", summary="s", description="d",
                    start_time=now, end_time=now, attendee_emails=[],
                )


class TestAbacLetsTheRankingThrough:
    def test_scores_and_application_keys_survive_masking_but_identity_does_not(self):
        row = {
            "candidate_uuid": "u", "application_id": "a", "application_status": "SUBMITTED",
            "submitted_at": "2026-09-01T00:00:00Z", "full_name": "Trần Bảo", "email": "b@x.y",
            "overall_score": 0.8, "summary_score": 0.7, "experience_score": 0.9, "github_score": None,
            "skills": ["Python"], "skills_matrix": {"must_have": {"matched": ["Python"], "missing": []}},
        }
        masked = apply_abac(row, "tech_lead")
        assert masked["full_name"] == "***" and masked["email"] == "***"
        for key in ("overall_score", "summary_score", "experience_score", "application_id",
                    "application_status", "submitted_at", "skills", "skills_matrix"):
            assert masked[key] == row[key], key


class TestRankingQueryColumns:
    """Tên cột trong truy vấn xếp hạng phải có thật trong docs/supabase_schema.md.

    Sai tên cột là lỗi chỉ lộ khi có người bấm vào tab — pytest không thấy.
    """

    def test_every_selected_column_exists_in_the_schema(self):
        schema = Path(__file__).resolve().parents[3].joinpath("docs/supabase_schema.md").read_text()

        def columns_of(table: str) -> set[str]:
            block = schema.split(f"CREATE TABLE public.{table} (")[1].split(");")[0]
            return {line.strip().split()[0] for line in block.splitlines() if line.strip() and not line.strip().startswith("CONSTRAINT")}

        select = SupabaseCatalogRepo.RANKING_SELECT
        top = re.split(r"candidates!inner\(", select)[0]
        for col in [c.strip() for c in top.split(",") if c.strip()]:
            assert col in columns_of("applications"), col
        cand = re.search(r"candidates!inner\(([^()]*)enrichment_profiles", select).group(1)
        for col in [c.strip() for c in cand.split(",") if c.strip()]:
            assert col in columns_of("candidates"), col
        enrich = re.search(r"enrichment_profiles!left\(([^()]*)\)", select).group(1)
        for col in [c.strip() for c in enrich.split(",") if c.strip()]:
            assert col in columns_of("enrichment_profiles"), col
