"""Chatbot tìm ứng viên trong phạm vi người gọi, giống màn hình /search.

Đồ thị agent từng dựng `CandidateSearchService` trần nên HR ở dashboard được
gợi ý cả ứng viên nộp vào tin của HR khác. Phạm vi phải ép vào bộ lọc cứng —
chạy TRƯỚC xếp hạng — để top-k không rỗng oan với HR có ít tin.
"""
import pytest

from modules.search.application.scoped_search import ScopedCandidateSearchService


class _Scope:
    def __init__(self, created=(), panel=(), on_jobs=()):
        self.created, self.panel, self.on_jobs = list(created), list(panel), list(on_jobs)
        self.asked_jobs = None

    def job_postings_created_by(self, user_id): return self.created
    def job_postings_for_reviewer(self, user_id): return self.panel
    def candidates_for_job_postings(self, job_ids):
        self.asked_jobs = list(job_ids); return self.on_jobs


class _SkillRepo:
    def __init__(self, ids): self.ids = ids
    async def get_candidate_ids_by_skills(self, skills):
        return [type("R", (), {"candidate_uuid": i})() for i in self.ids]


def _service(scope, role="hr", skill_ids=None):
    return ScopedCandidateSearchService(
        scope=scope, user_id="u1", role=role,
        search_repository=_SkillRepo(skill_ids or []), enrichment_repository=None,
        embedding_service=None, ranking_service=None,
    )


class _Req:
    def __init__(self, skills=None):
        self.hard_filter = type("H", (), {"skills": skills})() if skills else None


@pytest.mark.asyncio
async def test_without_a_skill_filter_the_scope_becomes_the_hard_filter():
    scope = _Scope(created=["job-1"], on_jobs=["c-1", "c-2"])
    assert await _service(scope)._apply_hard_filters(_Req()) == ["c-1", "c-2"]
    assert scope.asked_jobs == ["job-1"]


@pytest.mark.asyncio
async def test_skill_matches_are_intersected_with_the_scope():
    scope = _Scope(created=["job-1"], on_jobs=["c-1"])
    got = await _service(scope, skill_ids=["c-1", "c-9"])._apply_hard_filters(_Req(skills=["Python"]))
    assert got == ["c-1"]


@pytest.mark.asyncio
async def test_an_hr_with_no_postings_sees_nobody_not_everybody():
    # `[]` phải là "không ai" chứ không phải "không lọc" — đó là lỗ hổng cũ.
    scope = _Scope(created=[])
    assert await _service(scope)._apply_hard_filters(_Req()) == []
    assert scope.asked_jobs is None


@pytest.mark.asyncio
async def test_a_tech_lead_is_scoped_by_their_panels():
    scope = _Scope(panel=["job-7"], on_jobs=["c-7"])
    assert await _service(scope, role="tech_lead")._apply_hard_filters(_Req()) == ["c-7"]
    assert scope.asked_jobs == ["job-7"]


@pytest.mark.asyncio
async def test_no_user_means_no_data():
    scope = _Scope(created=["job-1"], on_jobs=["c-1"])
    assert await _service(scope, role=None)._apply_hard_filters(_Req()) == []


@pytest.mark.asyncio
async def test_admin_is_not_restricted():
    scope = _Scope()
    assert await _service(scope, role="admin")._apply_hard_filters(_Req()) is None
