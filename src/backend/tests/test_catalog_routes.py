"""Đường đọc dữ liệu danh sách.

Module `catalog` sinh ra để gỡ một thế kẹt: trình duyệt hỏi thẳng PostgREST
bằng anon key, nên tắt RLS thì ai cũng đọc được cả bảng, mà bật RLS thì màn
hình chết (Supabase không giải mã được JWT của ứng dụng). Những test dưới đây
giữ ba điều mà việc chuyển sang backend phải đổi lấy: lọc theo phạm vi của
người gọi (HR: tin mình tạo; tech lead: hội đồng), che PII theo role, và tin
ngoài phạm vi thì KHÔNG TỒN TẠI (404) chứ không "bị cấm" (403).
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from apps.main import app
from modules.auth.domain.models import AuthUser
from modules.catalog.adapters.routes import get_catalog_repo
from modules.catalog.domain.models import (
    CandidateCard,
    CandidateOption,
    ConfirmedSlotSummary,
    JobPostingSummary,
)
from modules.shared.infrastructure.auth_dependencies import get_current_user

JOB_MINE = "job-mine"
JOB_THEIRS = "job-theirs"

#: `sign_in` mặc định là user "u-1". JOB_MINE do u-1 tạo; JOB_THEIRS do HR khác.
HR_ME = "u-1"
HR_OTHER = "hr-other"


def _card(uuid: str, name: str, job: str) -> CandidateCard:
    return CandidateCard(
        candidate_uuid=uuid,
        full_name=name,
        email=f"{uuid}@example.com",
        company="Acme",
        job_posting_id=job,
        applied_job_title="Senior Backend Engineer",
        match_confidence_score=88.5,
    )


class FakeCatalogRepo:
    def __init__(self) -> None:
        self.cards = [
            _card("cand-1", "Trần Bảo", JOB_MINE),
            _card("cand-2", "Lê An", JOB_THEIRS),
        ]
        self.slots = [
            ConfirmedSlotSummary(id="s1", candidate_uuid="cand-1", start_time="2026-09-01T02:30:00Z"),
            ConfirmedSlotSummary(id="s2", candidate_uuid="cand-2", start_time="2026-09-02T02:30:00Z"),
        ]
        self.jobs = {
            JOB_MINE: {"id": JOB_MINE, "job_title": "Backend", "status": "PUBLISHED", "created_by": HR_ME},
            JOB_THEIRS: {"id": JOB_THEIRS, "job_title": "Frontend", "status": "PUBLISHED", "created_by": HR_OTHER},
        }
        self.panels = {"tl-on": [JOB_MINE], "tl-off": []}
        self.panel_sizes = {JOB_MINE: 1, JOB_THEIRS: 1}
        self.deleted: list[str] = []
        self.updated: list[tuple[str, dict]] = []
        self.created: list[dict] = []
        self.status_changes: list[tuple[str, str]] = []

    # JobVisibilitySource
    def job_postings_for_reviewer(self, reviewer_id):
        return self.panels.get(reviewer_id, [])

    def job_postings_created_by(self, user_id):
        return [j["id"] for j in self.jobs.values() if j["created_by"] == user_id]

    def list_candidate_cards(self, limit, job_posting_ids=None):
        if job_posting_ids is None:
            return list(self.cards)
        allowed = set(job_posting_ids)
        return [c for c in self.cards if c.job_posting_id in allowed]

    def list_candidate_options(self, limit, job_posting_ids=None):
        return [
            CandidateOption(candidate_uuid=c.candidate_uuid, full_name=c.full_name)
            for c in self.list_candidate_cards(limit, job_posting_ids)
        ]

    def list_confirmed_slots(self):
        return list(self.slots)

    def list_job_postings(self, job_posting_ids=None):
        rows = self.jobs.values()
        if job_posting_ids is not None:
            rows = [j for j in rows if j["id"] in set(job_posting_ids)]
        return [
            JobPostingSummary(id=j["id"], job_title=j["job_title"], status=j["status"], applicant_count=1)
            for j in rows
        ]

    def get_job_posting(self, job_posting_id):
        return self.jobs.get(job_posting_id)

    def get_user_summary(self, user_id):
        return {HR_ME: {"id": HR_ME, "name": "Mai", "company_name": "Acme"}}.get(user_id)

    def create_job_posting(self, payload):
        row = {"id": "job-new", **payload}
        self.created.append(row)
        self.jobs["job-new"] = row
        return row

    def update_job_posting(self, job_posting_id, payload):
        self.updated.append((job_posting_id, payload))
        return {**self.jobs[job_posting_id], **payload}

    def delete_job_posting(self, job_posting_id):
        self.deleted.append(job_posting_id)

    def set_job_posting_status(self, job_posting_id, status):
        self.status_changes.append((job_posting_id, status))

    def count_panel(self, job_posting_id):
        return self.panel_sizes.get(job_posting_id, 0)

    def duplicate_job_posting(self, job_posting_id, created_by):
        original = self.jobs[job_posting_id]
        row = {**original, "id": f"{job_posting_id}-copy", "status": "DRAFT", "created_by": created_by}
        self.jobs[row["id"]] = row
        return JobPostingSummary(id=row["id"], job_title=row["job_title"], status="DRAFT", applicant_count=0)

    def read_analytics(self, job_posting_ids=None):
        jobs = [{"id": j["id"], "job_title": j["job_title"]} for j in self.jobs.values()]
        applications = [
            {"id": "a1", "job_posting_id": JOB_MINE, "candidate_uuid": "cand-1"},
            {"id": "a2", "job_posting_id": JOB_THEIRS, "candidate_uuid": "cand-2"},
            {"id": "a3", "job_posting_id": JOB_THEIRS, "candidate_uuid": "cand-3"},
        ]
        candidates = [
            {"uuid": "cand-1", "current_location": "HCMC", "github_username": "octocat", "linkedin_url": None},
            {"uuid": "cand-2", "current_location": "HCMC", "github_username": None, "linkedin_url": "x"},
            {"uuid": "cand-3", "current_location": None, "github_username": None, "linkedin_url": None},
        ]
        if job_posting_ids is not None:
            allowed = set(job_posting_ids)
            jobs = [j for j in jobs if j["id"] in allowed]
            applications = [a for a in applications if a["job_posting_id"] in allowed]
            uuids = {a["candidate_uuid"] for a in applications}
            candidates = [c for c in candidates if c["uuid"] in uuids]
        return jobs, applications, candidates


@pytest.fixture(autouse=True)
def repo():
    fake = FakeCatalogRepo()
    app.dependency_overrides[get_catalog_repo] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_catalog_repo, None)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sign_in():
    def _apply(role: str, user_id: str = HR_ME) -> None:
        app.dependency_overrides[get_current_user] = lambda: AuthUser(
            id=user_id, email=f"{role}@smartats.com", name=role.upper(), role=role
        )

    yield _apply
    app.dependency_overrides.pop(get_current_user, None)


class TestAuthentication:
    @pytest.mark.parametrize(
        "path", ["/api/catalog/dashboard", "/api/catalog/job-postings", "/api/catalog/analytics"]
    )
    def test_every_read_requires_a_token(self, client, path):
        assert client.get(path).status_code == 401

    def test_admin_is_kept_out_of_business_data(self, client, sign_in):
        sign_in("admin")
        assert client.get("/api/catalog/dashboard").status_code == 403


class TestScoping:
    """Mỗi người chỉ thấy dữ liệu trong phạm vi của mình.

    Trước đây `hr` trả về "không giới hạn": một tài khoản HR vừa đăng ký, chưa
    tạo gì, mở dashboard là thấy toàn bộ ứng viên của mọi công ty đang dùng
    hệ thống.
    """

    def test_hr_sees_only_candidates_on_postings_they_created(self, client, sign_in):
        sign_in("hr")
        body = client.get("/api/catalog/dashboard").json()
        assert {c["candidate_uuid"] for c in body["candidates"]} == {"cand-1"}

    def test_a_brand_new_hr_sees_nothing_not_everything(self, client, sign_in):
        sign_in("hr", user_id="hr-new")
        body = client.get("/api/catalog/dashboard").json()
        assert body["candidates"] == []
        assert body["slots"] == []
        assert client.get("/api/catalog/job-postings").json() == []

    def test_a_tech_lead_sees_only_their_panel(self, client, sign_in):
        sign_in("tech_lead", user_id="tl-on")
        body = client.get("/api/catalog/dashboard").json()
        assert {c["candidate_uuid"] for c in body["candidates"]} == {"cand-1"}

    def test_a_tech_lead_on_no_panel_sees_nothing(self, client, sign_in):
        sign_in("tech_lead", user_id="tl-off")
        body = client.get("/api/catalog/dashboard").json()
        assert body["candidates"] == []
        assert body["slots"] == []

    def test_slots_follow_the_candidates(self, client, sign_in):
        # Một lịch phỏng vấn gắn với ứng viên mình không được xem vẫn tiết lộ
        # rằng người đó đang phỏng vấn.
        sign_in("hr")
        body = client.get("/api/catalog/dashboard").json()
        assert [s["candidate_uuid"] for s in body["slots"]] == ["cand-1"]

    def test_the_candidate_picker_is_scoped_too(self, client, sign_in):
        sign_in("tech_lead", user_id="tl-on")
        body = client.get("/api/catalog/candidates/options").json()
        assert [c["candidate_uuid"] for c in body] == ["cand-1"]

    def test_the_job_list_follows_the_same_rule(self, client, sign_in):
        sign_in("hr")
        assert [j["id"] for j in client.get("/api/catalog/job-postings").json()] == [JOB_MINE]

        sign_in("tech_lead", user_id="tl-on")
        assert [j["id"] for j in client.get("/api/catalog/job-postings").json()] == [JOB_MINE]

    def test_analytics_counts_only_what_the_caller_may_see(self, client, sign_in):
        sign_in("hr")
        body = client.get("/api/catalog/analytics").json()
        assert [j["id"] for j in body["jobs"]] == [JOB_MINE]
        assert body["candidate_count"] == 1
        assert body["candidates_with_github"] == 1
        assert body["candidates_with_linkedin"] == 0


class TestMasking:
    def test_hr_reads_names_and_emails(self, client, sign_in):
        sign_in("hr")
        card = client.get("/api/catalog/dashboard").json()["candidates"][0]
        assert card["full_name"] == "Trần Bảo"
        assert card["email"] == "cand-1@example.com"

    def test_a_tech_lead_gets_the_identity_masked(self, client, sign_in):
        # Đây chính là luật mà abac.py giữ, và là thứ mà đường đọc thẳng
        # PostgREST đi vòng qua hoàn toàn.
        sign_in("tech_lead", user_id="tl-on")
        card = client.get("/api/catalog/dashboard").json()["candidates"][0]
        assert card["full_name"] == "***"
        assert card["email"] == "***"

    def test_the_technical_signal_survives_masking(self, client, sign_in):
        # Che danh tính mà xoá luôn điểm số thì tech lead không chấm được gì.
        sign_in("tech_lead", user_id="tl-on")
        card = client.get("/api/catalog/dashboard").json()["candidates"][0]
        assert card["match_confidence_score"] == 88.5

    def test_a_tech_lead_still_knows_which_posting_the_candidate_applied_to(
        self, client, sign_in
    ):
        # Tên tin tuyển dụng không phải PII và là thứ giúp tech lead biết mình
        # đang chấm cho vị trí nào. Trường này từng tên là `title` và được vẽ
        # ngay dưới tên ứng viên, nên bị đọc nhầm thành chức danh hiện tại của
        # họ — tên mới phải vừa qua được ABAC vừa không gây nhầm.
        sign_in("tech_lead", user_id="tl-on")
        card = client.get("/api/catalog/dashboard").json()["candidates"][0]
        assert card["applied_job_title"] == "Senior Backend Engineer"
        assert "title" not in card


class TestJobPostings:
    def test_both_operational_roles_may_list(self, client, sign_in):
        for role in ("hr", "tech_lead"):
            sign_in(role)
            assert client.get("/api/catalog/job-postings").status_code == 200

    def test_a_tech_lead_on_the_panel_may_read_the_posting(self, client, sign_in):
        # Trang chi tiết tin là chung cho cả hai role; trước đây route này chỉ
        # cho `hr` nên tech lead mở tin mình đang chấm nhận 403.
        sign_in("tech_lead", user_id="tl-on")
        assert client.get(f"/api/catalog/job-postings/{JOB_MINE}").status_code == 200
        sign_in("tech_lead", user_id="tl-off")
        assert client.get(f"/api/catalog/job-postings/{JOB_MINE}").status_code == 404

    def test_the_detail_names_who_posted_it_and_their_company(self, client, sign_in):
        # Trang chi tiết ghi "đăng bởi" — tên và công ty (V009), không email
        # hay role của HR: tech lead trong hội đồng cũng đọc trang này.
        sign_in("tech_lead", user_id="tl-on")
        body = client.get(f"/api/catalog/job-postings/{JOB_MINE}").json()
        assert body["created_by_name"] == "Mai"
        assert body["created_by_company"] == "Acme"
        assert "email" not in body

    def test_someone_elses_posting_does_not_exist(self, client, sign_in, repo):
        # 404 chứ không 403: 403 xác nhận tin đó có thật, và một HR dò được id
        # của người khác chỉ bằng mã trạng thái.
        sign_in("hr")
        assert client.get(f"/api/catalog/job-postings/{JOB_THEIRS}").status_code == 404
        assert client.delete(f"/api/catalog/job-postings/{JOB_THEIRS}").status_code == 404
        assert client.patch(
            f"/api/catalog/job-postings/{JOB_THEIRS}/status", json={"status": "CLOSED"}
        ).status_code == 404
        assert client.post(f"/api/catalog/job-postings/{JOB_THEIRS}/duplicate").status_code == 404
        assert client.put(
            f"/api/catalog/job-postings/{JOB_THEIRS}", json={"job_title": "Hijacked"}
        ).status_code == 404
        assert repo.deleted == [] and repo.updated == [] and repo.status_changes == []

    def test_only_hr_may_delete(self, client, sign_in, repo):
        sign_in("tech_lead", user_id="tl-on")
        assert client.delete(f"/api/catalog/job-postings/{JOB_MINE}").status_code == 403
        assert repo.deleted == []

        sign_in("hr")
        assert client.delete(f"/api/catalog/job-postings/{JOB_MINE}").status_code == 204
        assert repo.deleted == [JOB_MINE]

    def test_a_new_posting_belongs_to_its_author(self, client, sign_in, repo):
        sign_in("hr")
        r = client.post("/api/catalog/job-postings", json={"job_title": "Data Engineer"})
        assert r.status_code == 201
        assert repo.created[0]["created_by"] == HR_ME
        assert repo.created[0]["status"] == "DRAFT"

    def test_a_duplicate_belongs_to_whoever_duplicated_it(self, client, sign_in, repo):
        # Kế thừa `created_by` của bản gốc thì người vừa bấm Duplicate không
        # thấy bản sao trong danh sách của mình.
        sign_in("hr")
        copy = client.post(f"/api/catalog/job-postings/{JOB_MINE}/duplicate").json()
        assert repo.jobs[copy["id"]]["created_by"] == HR_ME
        assert copy["status"] == "DRAFT"

    def test_publishing_needs_a_panel(self, client, sign_in, repo):
        sign_in("hr")
        repo.panel_sizes[JOB_MINE] = 0
        r = client.patch(f"/api/catalog/job-postings/{JOB_MINE}/status", json={"status": "PUBLISHED"})
        assert r.status_code == 400
        assert repo.status_changes == []


class TestAnalytics:
    def test_it_returns_counts_not_identities(self, client, sign_in):
        sign_in("hr", user_id=HR_OTHER)
        body = client.get("/api/catalog/analytics").json()

        assert body["candidate_count"] == 2
        assert body["candidates_with_github"] == 0
        assert body["candidates_with_linkedin"] == 1
        assert body["locations"] == {"HCMC": 1}
        # Màn hình này vẽ số liệu tổng hợp; tên và email không có lý do rời máy chủ.
        assert "candidates" not in body
