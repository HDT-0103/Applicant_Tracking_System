"""HTTP contract for /api/review.

Runs with no database: `get_current_user` and `get_review_repo` are both
overridden, so nothing here touches Supabase and nothing is left behind
between tests.

Most of what matters at this layer is the permission matrix, plus one rule
subtle enough to be worth pinning down: the Tech Lead panel must reach the
approval threshold before HR may record a decision at all.
"""
from __future__ import annotations

import uuid as _uuid

import pytest
from fastapi.testclient import TestClient

from apps.main import app
from modules.auth.domain.models import AuthUser
from modules.review.adapters.routes import get_review_repo
from modules.review.domain.models import CvReview, PanelMember
from modules.review.domain.repo_interface import IReviewRepo
from modules.shared.infrastructure.auth_dependencies import get_current_user


class FakeReviewRepo(IReviewRepo):
    """In-process stand-in for `cv_reviews`.

    `panel_size` is a plain attribute so a test can state the panel it means to
    exercise; the 80% rule reads very differently on a panel of one than on a
    panel of five.
    """

    def __init__(self, panel_size: int = 1) -> None:
        self.reviews: dict[str, list[CvReview]] = {}
        self.panel_size = panel_size
        self.application_status: dict[str, str] = {}
        self.frozen_panel_size: dict[str, int] = {}
        self.panel: dict[str, list] = {}
        #: Ai được xem hồ sơ nào. `None` = ai cũng được, để những test không
        #: quan tâm tới hội đồng khỏi phải khai.
        self.members: set[tuple[str, str]] | None = None

    async def get_reviews(self, candidate_uuid):
        return list(self.reviews.get(candidate_uuid, []))

    async def get_reviews_for_candidates(self, candidate_uuids):
        return {
            uuid_: list(self.reviews[uuid_])
            for uuid_ in candidate_uuids
            if uuid_ in self.reviews
        }

    async def save_review(self, review):
        bucket = self.reviews.setdefault(review.candidate_uuid, [])
        for i, existing in enumerate(bucket):
            if existing.reviewer_id == review.reviewer_id:
                bucket[i] = review
                return
        bucket.append(review)

    async def get_panel_size(self, candidate_uuid):
        return self.frozen_panel_size.get(candidate_uuid, self.panel_size)

    async def freeze_panel_size(self, candidate_uuid, size):
        self.frozen_panel_size.setdefault(candidate_uuid, size)

    async def is_panel_member(self, candidate_uuid, reviewer_id):
        if self.members is None:
            return True
        return (candidate_uuid, reviewer_id) in self.members

    async def filter_accessible(self, candidate_uuids, reviewer_id):
        if self.members is None:
            return set(candidate_uuids)
        return {c for c in candidate_uuids if (c, reviewer_id) in self.members}

    async def get_panel(self, job_posting_id):
        return list(self.panel.get(job_posting_id, []))

    async def add_panel_member(self, job_posting_id, reviewer_id, invited_by):
        self.panel.setdefault(job_posting_id, []).append(
            PanelMember(
                reviewer_id=reviewer_id,
                name="TL",
                email="tl@smartats.com",
                invited_at="2026-09-01T00:00:00Z",
            )
        )

    async def remove_panel_member(self, job_posting_id, reviewer_id):
        self.panel[job_posting_id] = [
            m for m in self.panel.get(job_posting_id, []) if m.reviewer_id != reviewer_id
        ]

    async def count_panel(self, job_posting_id):
        return len(self.panel.get(job_posting_id, []))

    async def set_application_status(self, candidate_uuid, status):
        self.application_status[candidate_uuid] = status


def _user(role: str) -> AuthUser:
    return AuthUser(
        id=str(_uuid.uuid4()),
        email=f"{role}@smartats.com",
        name=role.upper(),
        role=role,
    )


@pytest.fixture(autouse=True)
def repo() -> FakeReviewRepo:
    """Give every test its own empty store.

    Shared state used to make these tests order-dependent: a test that
    submitted a Tech Lead review changed the outcome of a later HR test.
    """
    fake = FakeReviewRepo()
    app.dependency_overrides[get_review_repo] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_review_repo, None)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def approving_panel(repo):
    """Put the panel past its approval threshold, so HR's turn has come."""

    def _apply() -> None:
        repo.reviews[CANDIDATE] = [
            CvReview(
                id="tl-1",
                candidate_uuid=CANDIDATE,
                reviewer_id="tl-1",
                reviewer_role="tech_lead",
                decision="approved",
            )
        ]

    return _apply


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

    def test_batch_requires_a_token(self, client):
        r = client.post("/api/review/batch", json={"candidate_uuids": [CANDIDATE]})
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

    def test_admin_may_not_read_status(self, client, as_role):
        as_role("admin")
        assert client.get(f"/api/review/{CANDIDATE}").status_code == 403


# ---------------------------------------------------------------------------
# Review ordering
# ---------------------------------------------------------------------------

class TestReviewOrdering:
    """Tech Lead panel first; HR cannot pre-empt the technical assessment.

    The ordering is the point of having two review stages: if HR could record a
    decision first, the technical review becomes a rubber stamp on a call that
    has already been made. The rule lives in the service, not the UI — hiding
    the button would still leave the endpoint open.
    """

    def test_hr_cannot_review_before_the_panel(self, client, as_role):
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

    def test_hr_may_review_once_the_panel_has_approved(
        self, client, as_role, approving_panel
    ):
        approving_panel()
        as_role("hr")
        r = client.post(f"/api/review/{CANDIDATE}", json={"decision": "approved"})
        assert r.status_code == 200, r.text
        assert r.json()["overall_status"] == "ready_to_schedule"

    def test_a_read_never_changes_the_application_status(
        self, client, as_role, repo, approving_panel
    ):
        # GET is on the dashboard's hot path; it used to write to
        # `applications` as a side effect of aggregating.
        approving_panel()
        as_role("hr")
        client.get(f"/api/review/{CANDIDATE}")
        assert repo.application_status == {}


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


# ---------------------------------------------------------------------------
# The panel rule
# ---------------------------------------------------------------------------

class TestPanelThreshold:
    """The 80% rule is the backend's to state, and the response has to carry it.

    The frontend used to hold its own copy of `0.8`. Two copies of a rule drift,
    and when they do the screen tells the reviewer something the server will not
    honour — so the numbers ship with the status.
    """

    def test_status_reports_how_many_approvals_are_needed(
        self, client, as_role, repo
    ):
        repo.panel_size = 5
        as_role("hr")
        body = client.get(f"/api/review/{CANDIDATE}").json()
        assert body["total_tls"] == 5
        assert body["required_tl_approvals"] == 4  # ceil(5 * 0.8)
        assert "4/5" in body["panel_rule"]

    def test_a_partial_panel_still_waits(self, client, as_role, repo):
        repo.panel_size = 5
        as_role("tech_lead")
        body = client.post(
            f"/api/review/{CANDIDATE}", json={"decision": "approved"}
        ).json()
        assert body["overall_status"] == "waiting_for_tls"

    def test_enough_rejections_end_it_without_waiting_for_the_rest(
        self, client, as_role, repo
    ):
        # On a panel of 5, two rejections put 4 approvals out of reach. Making
        # the other three vote anyway only delays a decision already made.
        repo.panel_size = 5
        repo.reviews[CANDIDATE] = [
            CvReview(
                id=f"tl-{i}",
                candidate_uuid=CANDIDATE,
                reviewer_id=f"tl-{i}",
                reviewer_role="tech_lead",
                decision="rejected",
            )
            for i in range(2)
        ]
        as_role("hr")
        body = client.get(f"/api/review/{CANDIDATE}").json()
        assert body["overall_status"] == "rejected_by_tls"

    def test_the_panel_is_never_smaller_than_the_votes_cast(
        self, client, as_role, repo
    ):
        # A tech lead deactivated after voting used to shrink the denominator,
        # pushing the approval ratio past 100% and passing the candidate.
        repo.panel_size = 1
        repo.reviews[CANDIDATE] = [
            CvReview(
                id=f"tl-{i}",
                candidate_uuid=CANDIDATE,
                reviewer_id=f"tl-{i}",
                reviewer_role="tech_lead",
                decision="approved" if i == 0 else "rejected",
            )
            for i in range(3)
        ]
        as_role("hr")
        body = client.get(f"/api/review/{CANDIDATE}").json()
        assert body["total_tls"] == 3
        assert body["overall_status"] != "ready_to_schedule"


# ---------------------------------------------------------------------------
# Batch status
# ---------------------------------------------------------------------------

class TestBatchStatus:
    """One request for a screenful of candidates instead of one per row."""

    def test_returns_a_status_for_every_candidate_asked_for(
        self, client, as_role, repo
    ):
        other = str(_uuid.uuid4())
        repo.reviews[CANDIDATE] = [
            CvReview(
                id="tl-1",
                candidate_uuid=CANDIDATE,
                reviewer_id="tl-1",
                reviewer_role="tech_lead",
                decision="approved",
            )
        ]
        as_role("hr")
        body = client.post(
            "/api/review/batch", json={"candidate_uuids": [CANDIDATE, other]}
        ).json()

        assert set(body) == {CANDIDATE, other}
        assert body[CANDIDATE]["overall_status"] == "waiting_for_hr"
        # Nobody has reviewed `other`; that is a state, not a missing resource.
        assert body[other]["overall_status"] == "waiting_for_tls"

    def test_batch_is_not_read_as_a_candidate_uuid(self, client, as_role):
        # `/batch` and `/{candidate_uuid}` are the same shape; registration
        # order is what keeps them apart.
        as_role("hr")
        r = client.post("/api/review/batch", json={"candidate_uuids": [CANDIDATE]})
        assert r.status_code == 200
        assert "batch" not in r.json()

    def test_an_oversized_batch_is_refused(self, client, as_role):
        as_role("hr")
        r = client.post(
            "/api/review/batch",
            json={"candidate_uuids": [str(_uuid.uuid4()) for _ in range(101)]},
        )
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# Hội đồng theo tin tuyển dụng (V008)
# ---------------------------------------------------------------------------

class TestPanelMembership:
    """Chỉ Tech Lead được HR mời mới xem và chấm được hồ sơ.

    Hồ sơ ứng viên chứa PII, nên đây là ranh giới bảo mật chứ không phải quy
    ước quy trình: một tech lead ngoài hội đồng không được nhìn thấy hồ sơ,
    chứ không phải "nhìn được nhưng không bấm được nút".
    """

    def test_a_tech_lead_off_the_panel_cannot_read_the_status(
        self, client, as_role, repo
    ):
        repo.members = set()  # không ai trong hội đồng nào
        as_role("tech_lead")
        r = client.get(f"/api/review/{CANDIDATE}")
        # 404 chứ không 403: 403 xác nhận ứng viên này CÓ TỒN TẠI, tức là tiết
        # lộ rằng ai đó đã ứng tuyển — bản thân điều đó là thông tin cá nhân.
        assert r.status_code == 404

    def test_a_tech_lead_off_the_panel_cannot_submit(self, client, as_role, repo):
        repo.members = set()
        as_role("tech_lead")
        r = client.post(f"/api/review/{CANDIDATE}", json={"decision": "approved"})
        assert r.status_code == 403
        assert "panel" in r.json()["detail"].lower()

    def test_hr_sees_every_candidate(self, client, as_role, repo):
        repo.members = set()
        as_role("hr")
        assert client.get(f"/api/review/{CANDIDATE}").status_code == 200

    def test_the_batch_omits_candidates_off_the_panel(self, client, as_role, repo):
        mine, theirs = CANDIDATE, str(_uuid.uuid4())
        repo.members = {(mine, "panel-member")}
        app.dependency_overrides[get_current_user] = lambda: AuthUser(
            id="panel-member", email="tl@smartats.com", name="TL", role="tech_lead"
        )
        try:
            body = client.post(
                "/api/review/batch", json={"candidate_uuids": [mine, theirs]}
            ).json()
        finally:
            app.dependency_overrides.pop(get_current_user, None)

        # Vắng hẳn, không phải trả về rỗng: một mục "đang chờ" cho ứng viên lạ
        # vẫn tiết lộ rằng người đó có ứng tuyển.
        assert set(body) == {mine}

    def test_only_hr_may_invite_a_reviewer(self, client, as_role):
        as_role("tech_lead")
        r = client.post("/api/review/panels/job-1", json={"reviewer_id": "tl-9"})
        # Để tech lead tự thêm mình vào hội đồng là để họ tự cấp quyền xem PII.
        assert r.status_code == 403

    def test_hr_invites_and_removes(self, client, as_role):
        as_role("hr")
        panel = client.post(
            "/api/review/panels/job-1", json={"reviewer_id": "tl-9"}
        ).json()
        assert [m["reviewer_id"] for m in panel] == ["tl-9"]

        panel = client.delete("/api/review/panels/job-1/tl-9").json()
        assert panel == []

    def test_inviting_the_same_person_twice_is_harmless(self, client, as_role, repo):
        as_role("hr")
        client.post("/api/review/panels/job-1", json={"reviewer_id": "tl-9"})
        r = client.post("/api/review/panels/job-1", json={"reviewer_id": "tl-9"})
        assert r.status_code == 200


class TestPanelSizeIsFrozen:
    """Sĩ số hội đồng chốt tại lá phiếu đầu tiên.

    Nếu tính theo thời gian thực, HR mời thêm một người là ứng viên sắp đủ
    phiếu bỗng quay về trạng thái đang chờ — ngưỡng đổi giữa chừng cuộc chấm.
    """

    def test_the_first_vote_freezes_the_size(self, client, as_role, repo):
        repo.panel_size = 5
        as_role("tech_lead")
        client.post(f"/api/review/{CANDIDATE}", json={"decision": "approved"})

        assert repo.frozen_panel_size[CANDIDATE] == 5

    def test_growing_the_panel_afterwards_does_not_move_the_goalposts(
        self, client, as_role, repo
    ):
        repo.panel_size = 5
        as_role("tech_lead")
        client.post(f"/api/review/{CANDIDATE}", json={"decision": "approved"})

        repo.panel_size = 20  # HR mời thêm 15 người sau đó
        body = client.get(f"/api/review/{CANDIDATE}").json()

        assert body["total_tls"] == 5
        assert body["required_tl_approvals"] == 4  # vẫn là ceil(5 * 0.8)

    def test_a_job_with_no_panel_never_reaches_hr(self, client, as_role, repo):
        # Ngưỡng 80% của 0 người là vô nghĩa. Không quy về hội đồng một người:
        # như thế một phiếu vu vơ là hồ sơ đậu.
        repo.panel_size = 0
        as_role("hr")
        body = client.get(f"/api/review/{CANDIDATE}").json()

        assert body["total_tls"] == 0
        assert body["required_tl_approvals"] == 0
        assert body["overall_status"] == "waiting_for_tls"
        assert "chưa có hội đồng" in body["panel_rule"]
