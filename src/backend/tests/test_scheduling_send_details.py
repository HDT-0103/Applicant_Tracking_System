"""Gửi thông tin phòng/địa chỉ phỏng vấn cho ứng viên.

Trước đây toàn bộ luồng này nằm trong hàm route và đọc thẳng
`service._repo._supabase`, nên không có cách nào kiểm thử ngoài việc dựng cả
FastAPI lẫn Supabase. Giờ nó là một use case của `SchedulingService`.
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from modules.scheduling.application.scheduling_service import SchedulingService
from modules.scheduling.domain.errors import (
    CandidateContactMissingError,
    SlotNotFoundError,
)
from modules.scheduling.domain.models import CandidateContact, ConfirmedSlot
from modules.scheduling.domain.repo_interface import ISchedulingRepo

SLOT_ID = "slot-1"
CANDIDATE_ID = "cand-1"


def _slot() -> ConfirmedSlot:
    return ConfirmedSlot(
        id=SLOT_ID,
        candidate_id=CANDIDATE_ID,
        # 02:30 UTC là 09:30 giờ Việt Nam — chọn mốc vắt qua nửa đêm UTC để
        # một lần quên đổi múi giờ sẽ lộ ra ở cả ngày lẫn giờ.
        start_time=datetime(2026, 9, 1, 2, 30, tzinfo=timezone.utc),
        end_time=datetime(2026, 9, 1, 3, 30, tzinfo=timezone.utc),
        interviewer_ids=["iv-1"],
    )


@pytest.fixture
def repo() -> MagicMock:
    repo = MagicMock(spec=ISchedulingRepo)
    repo.get_confirmed_slot.return_value = _slot()
    repo.get_candidate_contact.return_value = CandidateContact(
        candidate_id=CANDIDATE_ID, full_name="Trần Bảo", email="bao@example.com"
    )
    return repo


@pytest.fixture
def notifier() -> MagicMock:
    notifier = MagicMock()
    notifier.timezone = "Asia/Ho_Chi_Minh"
    notifier.send_room_details = AsyncMock()
    return notifier


@pytest.fixture
def service(repo, notifier) -> SchedulingService:
    return SchedulingService(
        repo=repo,
        calendar=MagicMock(),
        sweepline=MagicMock(),
        slack=MagicMock(),
        calendar_event=MagicMock(),
        email_notifier=notifier,
    )


@pytest.mark.asyncio
async def test_the_candidate_is_emailed_the_room_that_was_asked_for(
    service, notifier
):
    email = await service.send_interview_details(
        slot_id=SLOT_ID, room="Phòng 4.02", address="227 Nguyễn Văn Cừ"
    )

    assert email == "bao@example.com"
    sent = notifier.send_room_details.await_args.kwargs
    assert sent["candidate_email"] == "bao@example.com"
    assert sent["candidate_name"] == "Trần Bảo"
    assert sent["room"] == "Phòng 4.02"
    assert sent["address"] == "227 Nguyễn Văn Cừ"


@pytest.mark.asyncio
async def test_the_time_is_written_in_the_candidates_timezone(service, notifier):
    await service.send_interview_details(
        slot_id=SLOT_ID, room="Phòng 4.02", address="227 Nguyễn Văn Cừ"
    )

    slot_time = notifier.send_room_details.await_args.kwargs["slot_time"]
    # 02:30Z = 09:30 +07. In lịch theo UTC thì ứng viên đến sai bảy tiếng.
    assert "09:30 AM" in slot_time
    assert "Tuesday, September 01, 2026" in slot_time


@pytest.mark.asyncio
async def test_an_unknown_slot_is_reported_not_silently_skipped(service, repo, notifier):
    repo.get_confirmed_slot.return_value = None

    with pytest.raises(SlotNotFoundError):
        await service.send_interview_details(
            slot_id="nope", room="Phòng 4.02", address="227 Nguyễn Văn Cừ"
        )
    notifier.send_room_details.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_candidate_without_an_email_is_reported(service, repo, notifier):
    repo.get_candidate_contact.return_value = None

    with pytest.raises(CandidateContactMissingError):
        await service.send_interview_details(
            slot_id=SLOT_ID, room="Phòng 4.02", address="227 Nguyễn Văn Cừ"
        )
    notifier.send_room_details.assert_not_awaited()
