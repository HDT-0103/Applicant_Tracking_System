import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock

from modules.shared.infrastructure.abac import apply_abac
from modules.scheduling.application.sweep_line_service import SweepLineService
from modules.scheduling.application.scheduling_service import SchedulingService
from modules.scheduling.domain.models import FreeBusyInterval, Interviewer, TimeSlot, ConfirmedSlot, SchedulingConfig
from modules.scheduling.domain.repo_interface import ISchedulingRepo
from modules.scheduling.infra.google_calendar_service import GoogleCalendarService
from modules.scheduling.infra.calendar_event_service import CalendarEventService
from modules.scheduling.infra.email_notifier import EmailNotifier
from modules.scheduling.infra.slack_notifier import SlackNotifier
from modules.scheduling.infra.google_oauth_service import GoogleOAuthService


# Sample profile for ABAC testing
SAMPLE_CANDIDATE_PROFILE = {
    "candidate_uuid": "e0a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
    "enrichment_status": "ENRICHED",
    "enriched_profile": {
        "full_name": "Nguyen Van B",
        "email": "vanb.nguyen@example.com",
        "phone": "+84912345678",
        "address": "Ho Chi Minh City, Vietnam",
        "salary_expectation": "3500 USD",
        "github_username": "vanb-dev",
        "analytics": {
            "match_confidence_score": 94.0,
            "semantic_tags": ["python", "fastapi", "docker", "postgresql"],
            "technical_skill_matrix": {
                "pre_enrichment": [75.0, 60.0, 80.0, 70.0, 85.0],
                "post_enrichment": [90.0, 85.0, 95.0, 88.0, 92.0],
            },
        },
        "github": {
            "public_repos_count": 18,
            "top_languages": {"Python": 65.5, "Go": 24.5, "Dockerfile": 10.0},
            "readme_content": "Production-grade microservices with FastAPI and Docker",
        },
        "linkedin": {
            "full_name": "Nguyen Van B",
            "avatar_url": "https://media.licdn.com/dms/image/v2/avatar.jpg",
            "headline": "Senior Backend Engineer @ Fintech Corp",
            "experiences": [
                {
                    "title": "Senior Software Engineer",
                    "company": "Fintech Corp",
                    "start_date": "2021",
                    "end_date": "Present",
                }
            ],
            "educations": [
                {
                    "school": "University of Science",
                    "degree": "Bachelor of Science",
                    "field_of_study": "Computer Science",
                }
            ],
        },
    },
}


# ==============================================================================
# PARTITION 1: Full Access Clearance (HR & Admin)
# ==============================================================================
def test_tc1_abac_full_access_clearance_for_hr():
    """TC1: Partition 1 - Full Access Clearance for HR Role."""
    result = apply_abac(SAMPLE_CANDIDATE_PROFILE, "hr")
    profile = result["enriched_profile"]
    
    assert profile["full_name"] == "Nguyen Van B"
    assert profile["email"] == "vanb.nguyen@example.com"
    assert profile["phone"] == "+84912345678"
    assert profile["salary_expectation"] == "3500 USD"
    assert profile["linkedin"]["full_name"] == "Nguyen Van B"
    assert profile["linkedin"]["avatar_url"] == "https://media.licdn.com/dms/image/v2/avatar.jpg"
    assert profile["analytics"]["match_confidence_score"] == 94.0


# ==============================================================================
# PARTITION 2: Restricted Tech Role PII Masking (Tech Lead)
# ==============================================================================
def test_tc2_abac_tech_lead_pii_masking():
    """TC2: Partition 2 - Tech Lead Role PII Masking with Technical Whitelist."""
    result = apply_abac(SAMPLE_CANDIDATE_PROFILE, "tech_lead")
    profile = result["enriched_profile"]
    
    # Assert PII is redacted
    assert profile["full_name"] == "***"
    assert profile["email"] == "***"
    assert profile["phone"] == "***"
    assert profile["address"] == "***"
    assert profile["salary_expectation"] == "***"
    assert profile["linkedin"]["full_name"] == "***"
    assert profile["linkedin"]["avatar_url"] == "***"
    
    # Assert Technical Whitelist fields are preserved
    assert profile["analytics"]["match_confidence_score"] == 94.0
    assert profile["analytics"]["semantic_tags"] == ["python", "fastapi", "docker", "postgresql"]
    assert profile["github"]["public_repos_count"] == 18
    assert profile["github"]["top_languages"] == {"Python": 65.5, "Go": 24.5, "Dockerfile": 10.0}
    assert profile["linkedin"]["headline"] == "Senior Backend Engineer @ Fintech Corp"
    assert profile["linkedin"]["experiences"][0]["company"] == "Fintech Corp"


# ==============================================================================
# PARTITION 3: Default-Deny Policy & Schema Type Preservation
# ==============================================================================
def test_tc3_abac_default_deny_and_type_preservation():
    """TC3: Partition 3 - Default-Deny for Unknown Fields & Preserving Types."""
    payload = {
        "candidate_uuid": "c-123",
        "date_of_birth": "1995-12-25",
        "internal_credit_score": 780.5,
        "is_blacklisted": False,
        "private_tags": ["internal_referral", "vip"],
        "analytics": {"match_confidence_score": 88.0},
    }
    masked = apply_abac(payload, "tech_lead")
    
    assert masked["candidate_uuid"] == "c-123"
    assert masked["date_of_birth"] == "***"
    assert masked["internal_credit_score"] == 0
    assert masked["is_blacklisted"] is False
    assert masked["private_tags"] == []
    assert masked["analytics"]["match_confidence_score"] == 88.0


# ==============================================================================
# PARTITION 4: Valid Overlap >= 60m and >= 45m (SweepLine Overlap & Recommendation)
# ==============================================================================
def test_tc4_sweepline_multi_interviewer_valid_overlap_and_recommendation():
    """TC4: Partition 4 - Multi-Interviewer Overlap with Recommended Flag."""
    service = SweepLineService()
    
    base_time = datetime(2026, 9, 1, 8, 0, tzinfo=timezone.utc)
    # Interviewer 1 is free 08:00 - 10:30 (150 min)
    # Interviewer 2 is free 08:00 - 10:00 (120 min)
    # Overlap window is 08:00 - 10:00 (120 min)
    freebusy_map = {
        "interviewer-1": [
            FreeBusyInterval(
                interviewer_id="interviewer-1",
                start_time=base_time,
                end_time=base_time + timedelta(minutes=150),
            )
        ],
        "interviewer-2": [
            FreeBusyInterval(
                interviewer_id="interviewer-2",
                start_time=base_time,
                end_time=base_time + timedelta(minutes=120),
            )
        ],
    }
    
    slots = service.find_slots(freebusy_map, min_slot_minutes=45, limit=5)
    
    assert len(slots) >= 2
    # All slots should be at least 45 minutes
    for slot in slots:
        assert slot.duration_min >= 45
        assert set(slot.interviewer_ids) == {"interviewer-1", "interviewer-2"}
    
    # First slot starting at 08:00 to 08:45
    assert slots[0].start_time == base_time
    assert slots[0].end_time == base_time + timedelta(minutes=45)
    assert slots[0].duration_min == 45.0


# ==============================================================================
# PARTITION 5: Sub-Minimum Duration Discard (< 45 min)
# ==============================================================================
def test_tc5_sweepline_sub_minimum_duration_discard():
    """TC5: Partition 5 - Overlap strictly under 45 minutes is discarded."""
    service = SweepLineService()
    
    base_time = datetime(2026, 9, 1, 9, 0, tzinfo=timezone.utc)
    # Interviewer 1 is free 08:30 - 09:30
    # Interviewer 2 is free 09:00 - 10:30
    # Overlap is 09:00 - 09:30 (30 minutes < 45 min threshold)
    freebusy_map = {
        "interviewer-1": [
            FreeBusyInterval(
                interviewer_id="interviewer-1",
                start_time=base_time - timedelta(minutes=30),
                end_time=base_time + timedelta(minutes=30),
            )
        ],
        "interviewer-2": [
            FreeBusyInterval(
                interviewer_id="interviewer-2",
                start_time=base_time,
                end_time=base_time + timedelta(minutes=90),
            )
        ],
    }
    
    slots = service.find_slots(freebusy_map, min_slot_minutes=45, limit=5)
    
    # 30 min overlap cannot satisfy 45 min minimum, must return empty
    assert slots == []


# ==============================================================================
# PARTITION 6: Disjoint Schedules (Zero Overlap)
# ==============================================================================
def test_tc6_sweepline_disjoint_schedules_zero_overlap():
    """TC6: Partition 6 - Zero common free time handled gracefully."""
    service = SweepLineService()
    
    base_time = datetime(2026, 9, 1, 8, 0, tzinfo=timezone.utc)
    # Interviewer 1 is free 08:00 - 09:00
    # Interviewer 2 is free 09:00 - 10:00
    freebusy_map = {
        "interviewer-1": [
            FreeBusyInterval(
                interviewer_id="interviewer-1",
                start_time=base_time,
                end_time=base_time + timedelta(hours=1),
            )
        ],
        "interviewer-2": [
            FreeBusyInterval(
                interviewer_id="interviewer-2",
                start_time=base_time + timedelta(hours=1),
                end_time=base_time + timedelta(hours=2),
            )
        ],
    }
    
    slots = service.find_slots(freebusy_map, min_slot_minutes=45, limit=5)
    assert slots == []


# ==============================================================================
# PARTITION 7: State Transition - Expired Token Auto-Refresh Resilience
# ==============================================================================
@pytest.mark.asyncio
async def test_tc7_google_calendar_token_refresh_resilience():
    """TC7: Partition 7 - Expired Calendar Access Token Auto-Refreshed via OAuth."""
    mock_repo = MagicMock(spec=ISchedulingRepo)
    mock_calendar = MagicMock(spec=GoogleCalendarService)
    mock_sweepline = MagicMock(spec=SweepLineService)
    mock_slack = MagicMock(spec=SlackNotifier)
    mock_calendar_event = MagicMock(spec=CalendarEventService)
    mock_email = MagicMock(spec=EmailNotifier)
    mock_oauth = MagicMock(spec=GoogleOAuthService)
    
    interviewer = Interviewer(
        id="int-1",
        name="Lead Interviewer",
        email="lead@example.com",
        role="tech_lead",
        initials="LI",
        color="#3B82F6",
        calendar_api_key="expired_access_token",
        calendar_refresh_token="valid_refresh_token_xyz",
    )
    
    config = SchedulingConfig(work_start="08:00", work_end="18:00", min_slot_minutes=45)
    mock_repo.get_config.return_value = config
    mock_repo.get_interviewers.return_value = [interviewer]
    
    # First call returns empty (expired token), second call after refresh returns intervals
    base_time = datetime(2026, 9, 1, 9, 0, tzinfo=timezone.utc)
    mock_calendar.fetch_freebusy.side_effect = [
        [],  # Failed / empty on first attempt
        [FreeBusyInterval(interviewer_id="int-1", start_time=base_time, end_time=base_time + timedelta(hours=2))],  # Success after refresh
    ]
    
    mock_oauth.refresh_access_token = AsyncMock(return_value="new_refreshed_access_token_123")
    
    expected_slot = TimeSlot(
        start_time=base_time,
        end_time=base_time + timedelta(minutes=45),
        duration_min=45.0,
        interviewer_ids=["int-1"],
        recommendation="Recommended",
    )
    mock_sweepline.find_slots.return_value = [expected_slot]
    
    service = SchedulingService(
        repo=mock_repo,
        calendar=mock_calendar,
        sweepline=mock_sweepline,
        slack=mock_slack,
        calendar_event=mock_calendar_event,
        email_notifier=mock_email,
        oauth_service=mock_oauth,
    )
    
    slots = await service.query_slots(
        interviewer_ids=["int-1"],
        date_from=base_time,
        date_to=base_time + timedelta(days=1),
    )
    
    # Assert OAuth refresh was called with the refresh token
    mock_oauth.refresh_access_token.assert_awaited_once_with("valid_refresh_token_xyz")
    # Assert repository updated the interviewer key
    mock_repo.update_calendar_key.assert_called_with("int-1", "new_refreshed_access_token_123", "valid_refresh_token_xyz")
    # Assert slots returned successfully
    assert len(slots) == 1
    assert slots[0].duration_min == 45.0


# ==============================================================================
# PARTITION 8: State Mutation - Interview Booking & Multi-Channel Notification
# ==============================================================================
@pytest.mark.asyncio
async def test_tc8_interview_booking_and_multi_channel_notification():
    """TC8: Partition 8 - Confirmed Booking, GMT+7 Timezone Formatting & Dispatch."""
    mock_repo = MagicMock(spec=ISchedulingRepo)
    mock_calendar = MagicMock(spec=GoogleCalendarService)
    mock_sweepline = MagicMock(spec=SweepLineService)
    mock_slack = MagicMock(spec=SlackNotifier)
    mock_calendar_event = MagicMock(spec=CalendarEventService)
    mock_email = MagicMock(spec=EmailNotifier)
    
    interviewer = Interviewer(
        id="int-1",
        name="Tech Lead A",
        email="techlead@example.com",
        role="tech_lead",
        initials="TL",
        color="#10B981",
        calendar_api_key="valid_token",
    )
    mock_repo.get_interviewers.return_value = [interviewer]
    mock_repo.get_candidate_email.return_value = "applicant@example.com"
    
    # Slot in UTC: 2026-09-01 02:00:00 UTC (which is 09:00:00 GMT+7)
    slot_utc_start = datetime(2026, 9, 1, 2, 0, tzinfo=timezone.utc)
    slot_utc_end = datetime(2026, 9, 1, 2, 45, tzinfo=timezone.utc)
    
    mock_calendar_event.create_event = AsyncMock(return_value="cal_evt_12345")
    mock_email.notify_interviewers = AsyncMock(return_value=True)
    mock_slack.notify = AsyncMock(return_value=True)
    
    service = SchedulingService(
        repo=mock_repo,
        calendar=mock_calendar,
        sweepline=mock_sweepline,
        slack=mock_slack,
        calendar_event=mock_calendar_event,
        email_notifier=mock_email,
        slack_webhook_url="https://hooks.slack.com/services/T00/B00/X00",
    )
    
    confirmed = await service.confirm_slot(
        candidate_id="cand-001",
        candidate_name="Applicant One",
        start_time=slot_utc_start,
        end_time=slot_utc_end,
        interviewer_ids=["int-1"],
    )
    
    assert confirmed.candidate_id == "cand-001"
    assert confirmed.calendar_event_id == "cal_evt_12345"
    assert confirmed.slack_notified is True
    assert confirmed.email_notified is True
    
    # Verify mock interactions
    mock_repo.save_confirmed_slot.assert_called_once()
    mock_calendar_event.create_event.assert_awaited_once()
    mock_slack.notify.assert_awaited_once()
    mock_email.notify_interviewers.assert_awaited_once()


class TestCalendarTokenExpiry:
    """Token Google hết hạn KHÔNG được làm sập cả tính năng đặt lịch.

    `GoogleCalendarService.fetch_freebusy` NÉM khi Google trả 401 chứ không
    trả về rỗng. `query_slots` lại chỉ kiểm `if not fbs` để quyết định làm mới
    token, nên ngoại lệ bay thẳng ra ngoài thành HTTP 500 và nhánh làm mới
    không bao giờ chạy tới — smoke test trên môi trường thật bắt được đúng lỗi
    này, còn bộ unit test thì không, vì nó mock lịch bằng giá trị trả về.
    """

    @staticmethod
    def _service(calendar, oauth, interviewer):
        from modules.scheduling.application.scheduling_service import SchedulingService
        from modules.scheduling.application.sweep_line_service import SweepLineService

        repo = MagicMock(spec=ISchedulingRepo)
        repo.get_interviewers.return_value = [interviewer]
        repo.get_config.return_value = SchedulingConfig()
        return SchedulingService(
            repo=repo,
            calendar=calendar,
            sweepline=SweepLineService(),
            slack=MagicMock(),
            calendar_event=MagicMock(),
            email_notifier=MagicMock(),
            oauth_service=oauth,
        ), repo

    @staticmethod
    def _interviewer(**kw):
        from modules.scheduling.domain.models import Interviewer

        defaults = dict(
            id="iv-1", name="An", email="an@smartats.com", role="tech_lead",
            initials="A", color="#3B82F6",
            calendar_api_key="stale-token", calendar_refresh_token="refresh-me",
        )
        defaults.update(kw)
        return Interviewer(**defaults)

    @pytest.mark.asyncio
    async def test_a_401_triggers_a_refresh_instead_of_a_500(self):
        from datetime import datetime, timedelta, timezone

        from modules.scheduling.domain.models import FreeBusyInterval

        start = datetime(2026, 9, 1, 2, 0, tzinfo=timezone.utc)
        free = [
            FreeBusyInterval(
                interviewer_id="iv-1", start_time=start, end_time=start + timedelta(hours=3)
            )
        ]

        calendar = MagicMock()
        # Lần đầu ném 401, lần sau (sau khi làm mới) thành công.
        calendar.fetch_freebusy = AsyncMock(side_effect=[RuntimeError("401"), free])
        oauth = MagicMock()
        oauth.refresh_access_token = AsyncMock(return_value="fresh-token")

        service, repo = self._service(calendar, oauth, self._interviewer())
        slots = await service.query_slots(
            interviewer_ids=["iv-1"],
            date_from=start,
            date_to=start + timedelta(days=1),
        )

        oauth.refresh_access_token.assert_awaited_once_with("refresh-me")
        # Token mới phải được lưu lại, nếu không lần sau lại hỏng y hệt.
        repo.update_calendar_key.assert_called_once()
        assert slots, "làm mới token thành công mà vẫn không có khe giờ nào"

    @pytest.mark.asyncio
    async def test_an_unreadable_calendar_is_reported_not_guessed(self):
        from datetime import datetime, timedelta, timezone

        from modules.scheduling.domain.errors import CalendarUnavailableError

        calendar = MagicMock()
        calendar.fetch_freebusy = AsyncMock(side_effect=RuntimeError("401"))
        oauth = MagicMock()
        oauth.refresh_access_token = AsyncMock(return_value=None)  # làm mới cũng hỏng

        service, _ = self._service(calendar, oauth, self._interviewer())
        start = datetime(2026, 9, 1, 2, 0, tzinfo=timezone.utc)

        # KHÔNG quy về giờ làm việc tiêu chuẩn. Người này CÓ lịch mà hệ thống
        # không đọc được; coi họ rảnh cả ngày sẽ đề xuất khe giờ họ đang bận —
        # đúng thứ SRS gọi là false-positive overlap và cấm tuyệt đối.
        with pytest.raises(CalendarUnavailableError) as exc:
            await service.query_slots(
                interviewer_ids=["iv-1"], date_from=start, date_to=start + timedelta(days=1)
            )
        assert exc.value.interviewer_name == "An"

    @pytest.mark.asyncio
    async def test_someone_with_no_calendar_still_falls_back(self):
        from datetime import datetime, timedelta, timezone

        calendar = MagicMock()
        calendar.fetch_freebusy = AsyncMock(return_value=[])

        service, _ = self._service(
            calendar, MagicMock(),
            self._interviewer(calendar_api_key=None, calendar_refresh_token=None),
        )
        start = datetime(2026, 9, 1, 2, 0, tzinfo=timezone.utc)

        # Chưa kết nối lịch là chuyện khác hẳn: ở đây quy về giờ làm việc tiêu
        # chuẩn là lựa chọn sản phẩm có chủ đích, không phải đoán bừa.
        slots = await service.query_slots(
            interviewer_ids=["iv-1"], date_from=start, date_to=start + timedelta(days=2)
        )
        assert slots, "người chưa kết nối lịch phải vẫn có khe giờ dự phòng"


class TestNotificationFlagsArePersisted:
    """Kết quả gửi thông báo phải được GHI LẠI vào cơ sở dữ liệu.

    `confirm_slot` lưu lịch TRƯỚC rồi mới gọi Slack / Calendar / email — đúng,
    vì đợi gửi xong mới lưu thì một lần Slack treo là mất luôn cuộc phỏng vấn
    vừa chốt. Nhưng ba dòng gán kết quả sau đó chỉ sửa đối tượng trong bộ nhớ.
    Phản hồi HTTP trả về đúng, còn bảng `confirmed_slots` giữ nguyên giá trị
    mặc định — nên `slack_notified` trong DB LUÔN là false, kể cả khi tin đã
    gửi thành công, và `calendar_event_id` luôn null.

    Người vận hành tra `slack_notified` để biết nhóm tuyển dụng đã được báo
    chưa. Một cột luôn nói "chưa" thì vô dụng đúng vào lúc cần nó nhất.
    """

    @pytest.mark.asyncio
    async def test_the_flags_are_written_back_after_sending(self):
        from datetime import datetime, timedelta, timezone

        from modules.scheduling.application.scheduling_service import SchedulingService
        from modules.scheduling.application.sweep_line_service import SweepLineService
        from modules.scheduling.domain.models import Interviewer, SchedulingConfig

        interviewer = Interviewer(
            id="iv-1", name="An", email="an@smartats.com", role="tech_lead",
            initials="A", color="#3B82F6", calendar_api_key="token",
        )
        repo = MagicMock(spec=ISchedulingRepo)
        repo.get_interviewers.return_value = [interviewer]
        repo.get_config.return_value = SchedulingConfig()
        repo.get_candidate_email.return_value = "bao@example.com"
        repo.save_confirmed_slot.side_effect = lambda s: s

        slack = MagicMock()
        slack.notify = AsyncMock(return_value=True)
        email = MagicMock()
        email.notify_interviewers = AsyncMock(return_value=True)
        calendar_event = MagicMock()
        calendar_event.create_event = AsyncMock(return_value="gcal-event-1")

        service = SchedulingService(
            repo=repo,
            calendar=MagicMock(),
            sweepline=SweepLineService(),
            slack=slack,
            calendar_event=calendar_event,
            email_notifier=email,
            slack_webhook_url="https://hooks.slack.com/services/T/B/X",
        )

        start = datetime(2026, 9, 1, 2, 0, tzinfo=timezone.utc)
        slot = await service.confirm_slot(
            candidate_id="cand-1",
            candidate_name="Trần Bảo",
            start_time=start,
            end_time=start + timedelta(minutes=45),
            interviewer_ids=["iv-1"],
        )

        assert slot.slack_notified is True
        repo.update_slot_notifications.assert_called_once()
        saved = repo.update_slot_notifications.call_args[0][0]
        assert saved.slack_notified is True
        assert saved.email_notified is True
        assert saved.calendar_event_id == "gcal-event-1"

    @pytest.mark.asyncio
    async def test_a_write_back_failure_does_not_lose_the_interview(self):
        from datetime import datetime, timedelta, timezone

        from modules.scheduling.application.scheduling_service import SchedulingService
        from modules.scheduling.application.sweep_line_service import SweepLineService
        from modules.scheduling.domain.models import SchedulingConfig

        repo = MagicMock(spec=ISchedulingRepo)
        repo.get_interviewers.return_value = []
        repo.get_config.return_value = SchedulingConfig()
        repo.get_candidate_email.return_value = None
        repo.save_confirmed_slot.side_effect = lambda s: s
        repo.update_slot_notifications.side_effect = RuntimeError("DB đang bận")

        slack = MagicMock()
        slack.notify = AsyncMock(return_value=False)
        email = MagicMock()
        email.notify_interviewers = AsyncMock(return_value=False)

        service = SchedulingService(
            repo=repo, calendar=MagicMock(), sweepline=SweepLineService(),
            slack=slack, calendar_event=MagicMock(), email_notifier=email,
        )
        start = datetime(2026, 9, 1, 2, 0, tzinfo=timezone.utc)

        # Lịch đã chốt và thông báo đã đi. Ghi cờ hỏng là sai sổ sách, không
        # phải hỏng nghiệp vụ — không được ném lỗi vào mặt HR.
        slot = await service.confirm_slot(
            candidate_id="cand-1", candidate_name="Trần Bảo",
            start_time=start, end_time=start + timedelta(minutes=45),
            interviewer_ids=[],
        )
        assert slot is not None
