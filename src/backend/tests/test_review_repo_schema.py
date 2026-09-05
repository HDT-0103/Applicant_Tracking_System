"""Tên cột mà `SupabaseReviewRepo` gửi đi phải khớp schema thật.

Ba lỗi 500 trên môi trường thật đều cùng một nguyên nhân: repo hỏi
`applications.candidate_id`, còn cột thật tên `candidate_uuid`. Test đơn vị
không bắt được vì chúng chạy trên repo giả, và tầng thật thì chỉ lộ ra khi có
người bấm vào màn hình.

Những test dưới đây chặn đúng lớp đó: chúng ghi lại TÊN CỘT mà repo gửi cho
PostgREST, không cần cơ sở dữ liệu.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from modules.review.infra.impl_supabase import SupabaseReviewRepo

#: Cột định danh ứng viên trong bảng `applications`.
#: KHÔNG phải `candidate_id` — Postgres đã nói thẳng:
#: 'Perhaps you meant to reference the column "applications.candidate_uuid"'.
CANDIDATE_COLUMN = "candidate_uuid"


class _Recorder:
    """Ghi lại mọi lời gọi `.eq()` / `.in_()` rồi trả về dữ liệu rỗng."""

    def __init__(self) -> None:
        self.tables: list[str] = []
        self.filters: list[tuple[str, str]] = []
        self.updates: list[dict] = []

    def table(self, name: str):
        self.tables.append(name)
        builder = MagicMock()

        def eq(column, value):
            self.filters.append((name, column))
            return builder

        def in_(column, values):
            self.filters.append((name, column))
            return builder

        def update(payload):
            self.updates.append(payload)
            return builder

        builder.select.return_value = builder
        builder.order.return_value = builder
        builder.limit.return_value = builder
        builder.eq.side_effect = eq
        builder.in_.side_effect = in_
        builder.update.side_effect = update
        builder.delete.return_value = builder
        builder.upsert.return_value = builder
        builder.execute.return_value = MagicMock(data=[], count=0)
        return builder

    def columns_used_on(self, table: str) -> set[str]:
        return {col for t, col in self.filters if t == table}


@pytest.fixture
def recorder() -> _Recorder:
    return _Recorder()


@pytest.fixture
def repo(recorder) -> SupabaseReviewRepo:
    return SupabaseReviewRepo(recorder)


@pytest.mark.asyncio
async def test_get_panel_size_filters_applications_by_candidate_uuid(repo, recorder):
    await repo.get_panel_size("cand-1")
    assert recorder.columns_used_on("applications") == {CANDIDATE_COLUMN}


@pytest.mark.asyncio
async def test_job_posting_of_candidate_filters_applications_by_candidate_uuid(repo, recorder):
    await repo.job_posting_of_candidate("cand-1")
    assert CANDIDATE_COLUMN in recorder.columns_used_on("applications")


@pytest.mark.asyncio
async def test_candidates_on_job_postings_filters_by_candidate_uuid(repo, recorder):
    await repo.candidates_on_job_postings(["cand-1"], ["job-1"])
    used = recorder.columns_used_on("applications")
    assert CANDIDATE_COLUMN in used
    assert "candidate_id" not in used


@pytest.mark.asyncio
async def test_batch_applications_filter_by_candidate_uuid(repo, recorder):
    await repo.applications_for_candidates(["cand-1", "cand-2"])
    assert recorder.columns_used_on("applications") == {CANDIDATE_COLUMN}


@pytest.mark.asyncio
async def test_batch_panel_counts_filter_by_job_posting_id(repo, recorder):
    await repo.count_panels(["job-1"])
    assert recorder.columns_used_on("job_posting_reviewers") == {"job_posting_id"}


@pytest.mark.asyncio
async def test_ownership_is_read_from_jobs_posting_created_by(repo, recorder):
    # Cột thật là `created_by` (FK -> users.id). Không phải owner_id hay
    # recruiter_id — hai cái tên nghe hợp lý nhưng không tồn tại.
    await repo.job_postings_created_by("hr-1")
    assert recorder.columns_used_on("jobs_posting") == {"created_by"}


@pytest.mark.asyncio
async def test_panel_membership_is_read_from_job_posting_reviewers(repo, recorder):
    await repo.job_postings_for_reviewer("tl-1")
    assert recorder.columns_used_on("job_posting_reviewers") == {"reviewer_id"}


@pytest.mark.asyncio
async def test_set_application_status_filters_by_candidate_uuid(repo, recorder):
    await repo.set_application_status("cand-1", "REJECTED")
    assert recorder.columns_used_on("applications") == {CANDIDATE_COLUMN}
    assert recorder.updates == [{"status": "REJECTED"}]


@pytest.mark.asyncio
async def test_reviews_are_read_from_cv_reviews_by_candidate_uuid(repo, recorder):
    await repo.get_reviews("cand-1")
    assert recorder.columns_used_on("cv_reviews") == {CANDIDATE_COLUMN}
