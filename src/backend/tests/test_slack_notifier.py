"""Thông báo Slack khi chốt lịch phỏng vấn.

Template3 TC8 mô tả kênh này: "booking state mutation (CONFIRMED), GMT+7
timestamp formatting, và gửi đồng thời Email lẫn Slack". Trước đây không có
test nào cho riêng Slack — chỉ có một mock được assert là đã gọi.

Nguyên tắc xuyên suốt: Slack là kênh PHỤ. Thiếu cấu hình hay gửi hỏng đều
không được làm hỏng việc đặt lịch, nhưng cũng không được im lặng — một cuộc
phỏng vấn đã chốt mà nhóm tuyển dụng không biết là điều người vận hành cần
nhìn thấy.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from modules.scheduling.domain.models import ConfirmedSlot, Interviewer
from modules.scheduling.infra import slack_notifier as mod
from modules.scheduling.infra.slack_notifier import SlackNotifier

WEBHOOK = "https://hooks.slack.com/services/T00/B00/XXX"


def _slot() -> ConfirmedSlot:
    # 02:30 UTC = 09:30 giờ Việt Nam. Chọn mốc vắt qua nửa đêm UTC để một lần
    # quên đổi múi giờ sẽ lộ ra ở cả ngày lẫn giờ.
    start = datetime(2026, 9, 1, 2, 30, tzinfo=timezone.utc)
    return ConfirmedSlot(
        id="slot-1",
        candidate_id="cand-1",
        start_time=start,
        end_time=start + timedelta(minutes=45),
        interviewer_ids=["iv-1", "iv-2"],
    )


def _panel() -> list[Interviewer]:
    return [
        Interviewer(
            id="iv-1", name="An", email="an@smartats.com", role="tech_lead",
            initials="A", color="#3B82F6",
        ),
        Interviewer(
            id="iv-2", name="Bảo", email="bao@smartats.com", role="tech_lead",
            initials="B", color="#10B981",
        ),
    ]


def _capture_post():
    """Bắt payload gửi đi mà không chạm mạng."""
    response = MagicMock()
    response.raise_for_status = MagicMock()
    client = MagicMock()
    client.post = AsyncMock(return_value=response)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=False)
    return client


class TestWhenConfigured:
    @pytest.mark.asyncio
    async def test_the_message_names_who_when_and_how_long(self):
        client = _capture_post()
        with patch.object(mod.httpx, "AsyncClient", return_value=client):
            sent = await SlackNotifier().notify(
                _slot(), "Trần Bảo", _panel(), WEBHOOK
            )

        assert sent is True
        url, kwargs = client.post.await_args[0][0], client.post.await_args[1]
        assert url == WEBHOOK

        text = kwargs["json"]["text"]
        assert "Trần Bảo" in text
        assert "An, Bảo" in text
        assert "45 min" in text

    @pytest.mark.asyncio
    async def test_the_time_is_local_not_utc(self):
        client = _capture_post()
        with patch.object(mod.httpx, "AsyncClient", return_value=client):
            await SlackNotifier().notify(_slot(), "Trần Bảo", _panel(), WEBHOOK)

        text = client.post.await_args[1]["json"]["text"]
        # 02:30Z là 09:30 +07. In theo UTC thì cả nhóm đến sai bảy tiếng.
        assert "09:30 AM" in text
        assert "Sep 01" in text

    @pytest.mark.asyncio
    async def test_it_follows_the_configured_timezone(self):
        # Email đã dùng APP_TIMEZONE; nếu Slack không dùng thì hai thông báo
        # về CÙNG một cuộc phỏng vấn ghi hai giờ khác nhau.
        client = _capture_post()
        with patch.object(mod.httpx, "AsyncClient", return_value=client):
            await SlackNotifier(app_timezone="UTC").notify(
                _slot(), "Trần Bảo", _panel(), WEBHOOK
            )

        text = client.post.await_args[1]["json"]["text"]
        assert "02:30 AM" in text
        assert "UTC" in text


class TestWhenSomethingIsWrong:
    @pytest.mark.asyncio
    async def test_a_missing_webhook_is_reported_not_swallowed(self):
        with patch.object(mod, "logger") as log:
            sent = await SlackNotifier().notify(_slot(), "Trần Bảo", _panel(), None)

        assert sent is False
        # warning, không phải info: nhóm tuyển dụng vừa không được báo về một
        # cuộc phỏng vấn đã chốt.
        log.warning.assert_called_once()
        assert log.warning.call_args[0][0] == "scheduling.slack.no_webhook_url"

    @pytest.mark.asyncio
    async def test_a_failed_post_does_not_raise(self):
        # Slack hỏng KHÔNG được kéo theo việc đặt lịch — lịch đã tạo, email đã
        # gửi. `slack_notified=False` là cách ghi lại sự thật đó.
        client = _capture_post()
        client.post = AsyncMock(side_effect=RuntimeError("slack is down"))
        with patch.object(mod.httpx, "AsyncClient", return_value=client), patch.object(
            mod, "logger"
        ) as log:
            sent = await SlackNotifier().notify(_slot(), "Trần Bảo", _panel(), WEBHOOK)

        assert sent is False
        log.error.assert_called_once()

    @pytest.mark.asyncio
    async def test_an_empty_panel_still_sends(self):
        # Không có ai trong hội đồng là dữ liệu lạ, nhưng không phải lý do để
        # nuốt luôn thông báo.
        client = _capture_post()
        with patch.object(mod.httpx, "AsyncClient", return_value=client):
            sent = await SlackNotifier().notify(_slot(), "Trần Bảo", [], WEBHOOK)

        assert sent is True
