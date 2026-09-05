"""Tìm kiếm và xếp hạng ứng viên theo ngữ nghĩa (SRS §3.2.1d).

Luồng này đã có mã nguồn từ lâu trong cây `src/backend/app/`, nhưng
`apps/main.py` chưa bao giờ nạp nó và không có route nào chạm tới — tính năng
tồn tại trên giấy và trong repo, không tồn tại trong ứng dụng đang chạy.

`modules/search` là lớp adapter nối nó vào. Nghiệp vụ xếp hạng đã có test
riêng ở `tests/` gốc repo; những test dưới đây giữ phần mà lớp adapter chịu
trách nhiệm: phân quyền, che PII, ngưỡng lọc, và giới hạn đầu vào.
"""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from apps.main import app
from modules.auth.domain.models import AuthUser
from modules.search.adapters.routes import get_search_service
from modules.search.application.search_service import MAX_TOP_K, SearchService
from modules.shared.infrastructure.auth_dependencies import get_current_user


def _result(uuid: str, score: float, name: str = "Trần Bảo") -> dict:
    """Một kết quả THÔ, trước khi che — đúng như tầng dưới trả lên."""
    return {
        "candidate_id": uuid,
        "score": score,
        "summary": f"{name} là kỹ sư backend 5 năm kinh nghiệm",
        "skills": ["Python", "FastAPI"],
        "strengths": ["Thiết kế API"],
        "weaknesses": ["Chưa dùng Kubernetes"],
        "experiences": [
            {
                "company": "Acme",
                "position": "Backend Developer",
                "duration": "2 năm",
                "highlights": ["Xây dựng hệ thống thanh toán"],
            }
        ],
        "github_summary": "10 repo công khai",
        "linkedin_summary": "5 năm kinh nghiệm",
    }


class FakeInner:
    """Đứng thay `CandidateSearchService` của cây `app/`.

    Nhận vào yêu cầu đã dựng và trả về DTO — nhờ vậy test này không cần
    Supabase, không cần pgvector, và không nạp mô hình nhúng nặng vài trăm MB.
    """

    def __init__(self, results: list[dict]) -> None:
        from modules.search.infra.legacy_bridge import CandidateSearchResultDTO

        self.results = [CandidateSearchResultDTO(**r) for r in results]
        self.last_requirement = None
        self.last_top_k = None

    async def search(self, requirement, top_k):
        self.last_requirement = requirement
        self.last_top_k = top_k
        return list(self.results)


@pytest.fixture
def inner() -> FakeInner:
    return FakeInner(
        [
            _result("cand-1", 0.90),
            _result("cand-2", 0.70, name="Lê An"),
            _result("cand-3", 0.40, name="Phạm Cường"),
        ]
    )


class FakeScope:
    """Phạm vi: `u-1` (HR) tạo `job-1` và cũng chấm `job-1`; ai khác thì không.

    Mặc định cả ba ứng viên đều nộp vào `job-1`; test về ranh giới đổi
    `candidate_jobs` để đẩy một người sang tin khác.
    """

    def __init__(self) -> None:
        self.owners = {"job-1": "u-1"}
        self.panels = {"u-1": ["job-1"]}
        self.candidate_jobs = {"cand-1": "job-1", "cand-2": "job-1", "cand-3": "job-1"}

    def job_postings_created_by(self, user_id):
        return [j for j, o in self.owners.items() if o == user_id]

    def job_postings_for_reviewer(self, reviewer_id):
        return list(self.panels.get(reviewer_id, []))

    def candidates_on_job_postings(self, candidate_uuids, job_posting_ids):
        allowed = set(job_posting_ids)
        return {c for c in candidate_uuids if self.candidate_jobs.get(c) in allowed}


@pytest.fixture
def scope() -> FakeScope:
    return FakeScope()


@pytest.fixture(autouse=True)
def service(inner, scope):
    svc = SearchService.__new__(SearchService)
    svc._inner = inner
    svc._scope = scope
    app.dependency_overrides[get_search_service] = lambda: svc
    yield svc
    app.dependency_overrides.pop(get_search_service, None)


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


QUERY = {"summary": "Senior Python backend engineer", "top_k": 10}


class TestScoping:
    """Tầng vector xếp hạng trên TOÀN BỘ ứng viên và không biết ai đang hỏi.

    Không lọc ở adapter thì màn hình tìm kiếm là đường vòng qua mọi ranh giới
    dữ liệu: một HR chưa tạo tin nào vẫn xếp hạng được ứng viên của công ty
    khác, một tech lead ngoài mọi hội đồng vẫn thấy điểm của mọi người.
    """

    def test_hr_only_ranks_candidates_who_applied_to_their_postings(
        self, client, sign_in, scope
    ):
        scope.candidate_jobs["cand-2"] = "job-of-someone-else"
        sign_in("hr")
        body = client.post("/api/search", json=QUERY).json()
        assert [r["candidate_uuid"] for r in body["results"]] == ["cand-1", "cand-3"]
        assert body["total"] == 2

    def test_a_tech_lead_only_ranks_their_panel(self, client, sign_in, scope):
        scope.panels = {"tl-2": ["job-1"]}
        scope.candidate_jobs["cand-3"] = "job-2"
        sign_in("tech_lead", user_id="tl-2")
        body = client.post("/api/search", json=QUERY).json()
        assert [r["candidate_uuid"] for r in body["results"]] == ["cand-1", "cand-2"]

    def test_someone_with_no_postings_gets_an_empty_list_not_everyone(
        self, client, sign_in
    ):
        sign_in("hr", user_id="hr-new")
        body = client.post("/api/search", json=QUERY).json()
        assert body["results"] == []
        assert body["total"] == 0


class TestAccess:
    def test_it_requires_a_token(self, client):
        assert client.post("/api/search", json=QUERY).status_code == 401

    @pytest.mark.parametrize("role", ["hr", "tech_lead"])
    def test_both_operational_roles_may_search(self, client, sign_in, role):
        sign_in(role)
        assert client.post("/api/search", json=QUERY).status_code == 200

    def test_admin_may_not(self, client, sign_in):
        # admin quản trị hệ thống; đọc hồ sơ ứng viên không phải việc của họ.
        sign_in("admin")
        assert client.post("/api/search", json=QUERY).status_code == 403


class TestMasking:
    """Đây là lý do luồng này phải đi qua adapter thay vì phơi thẳng service cũ.

    `app/` không biết gì về ABAC. Gọi thẳng nó từ HTTP là mở một cửa hậu vòng
    qua toàn bộ lớp che dữ liệu của hệ thống.
    """

    def test_hr_sees_the_summary(self, client, sign_in):
        sign_in("hr")
        top = client.post("/api/search", json=QUERY).json()["results"][0]
        assert "Trần Bảo" in top["summary"]

    def test_a_tech_lead_does_not(self, client, sign_in):
        sign_in("tech_lead")
        top = client.post("/api/search", json=QUERY).json()["results"][0]
        # Ba trường *summary là văn bản tự do do LLM viết và gần như chắc chắn
        # nhắc tên ứng viên.
        assert top["summary"] == "***"
        assert top["github_summary"] == "***"
        assert top["linkedin_summary"] == "***"

    def test_a_tech_lead_still_gets_what_they_are_here_to_judge(
        self, client, sign_in
    ):
        # Che hết thì bảng xếp hạng vô dụng với đúng người được giao đọc nó.
        sign_in("tech_lead")
        top = client.post("/api/search", json=QUERY).json()["results"][0]

        assert top["score"] == 0.90
        assert top["skills"] == ["Python", "FastAPI"]
        assert top["strengths"] == ["Thiết kế API"]
        assert top["experiences"][0]["position"] == "Backend Developer"

    def test_the_candidate_id_survives_so_the_profile_can_be_opened(
        self, client, sign_in
    ):
        # Trường này tên `candidate_id` ở DTO gốc, mà whitelist so khớp theo
        # TÊN — giữ nguyên thì mã bị che thành "***" và không mở nổi hồ sơ nào.
        sign_in("tech_lead")
        top = client.post("/api/search", json=QUERY).json()["results"][0]
        assert top["candidate_uuid"] == "cand-1"


class TestThreshold:
    def test_no_threshold_keeps_everything(self, client, sign_in):
        sign_in("hr")
        assert client.post("/api/search", json=QUERY).json()["total"] == 3

    def test_the_slider_filters_after_scoring(self, client, sign_in, inner):
        sign_in("hr")
        body = client.post("/api/search", json={**QUERY, "min_score": 0.7}).json()

        assert [r["candidate_uuid"] for r in body["results"]] == ["cand-1", "cand-2"]
        # Lọc SAU khi đã chấm điểm: kéo thanh trượt không chạy lại truy vấn
        # vector, nên tầng dưới vẫn nhận đúng một yêu cầu như cũ.
        assert inner.last_top_k == 10

    def test_the_response_repeats_the_threshold_it_applied(self, client, sign_in):
        sign_in("hr")
        body = client.post("/api/search", json={**QUERY, "min_score": 0.5}).json()
        assert body["min_score"] == 0.5

    def test_a_threshold_nothing_reaches_is_an_empty_list_not_an_error(
        self, client, sign_in
    ):
        sign_in("hr")
        body = client.post("/api/search", json={**QUERY, "min_score": 0.99}).json()
        assert body["results"] == []
        assert body["total"] == 0


class TestRequestShape:
    def test_hard_skills_reach_the_filter(self, client, sign_in, inner):
        sign_in("hr")
        client.post(
            "/api/search", json={**QUERY, "required_skills": ["Python", "Docker"]}
        )
        assert inner.last_requirement.hard_filter.skills == ["Python", "Docker"]

    def test_no_hard_filter_when_no_skills_are_given(self, client, sign_in, inner):
        sign_in("hr")
        client.post("/api/search", json=QUERY)
        # `None` chứ không phải danh sách rỗng: tầng dưới phân biệt "không lọc"
        # với "lọc theo danh sách rỗng", và cái sau loại sạch mọi ứng viên.
        assert inner.last_requirement.hard_filter is None

    def test_the_experience_field_is_carried_through(self, client, sign_in, inner):
        sign_in("hr")
        client.post("/api/search", json={**QUERY, "experience": "3 năm backend"})
        assert inner.last_requirement.soft_query.experience == "3 năm backend"

    def test_an_empty_query_is_refused(self, client, sign_in):
        sign_in("hr")
        assert client.post("/api/search", json={"summary": ""}).status_code == 422

    def test_top_k_is_capped(self, client, sign_in):
        sign_in("hr")
        r = client.post("/api/search", json={**QUERY, "top_k": MAX_TOP_K + 1})
        # Có trần thì một client hỏng không kéo được cả bảng về, mà mỗi kết quả
        # còn phải qua bước che PII.
        assert r.status_code == 422

    def test_a_threshold_outside_zero_to_one_is_refused(self, client, sign_in):
        sign_in("hr")
        assert client.post("/api/search", json={**QUERY, "min_score": 1.5}).status_code == 422
