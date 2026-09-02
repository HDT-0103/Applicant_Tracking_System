from typing import Optional

import httpx
import structlog

from modules.scheduling.domain.models import ConfirmedSlot, Interviewer
from modules.scheduling.infra.email_notifier import to_local_tz

logger = structlog.get_logger(__name__)


class SlackNotifier:
    """Đẩy thông báo lịch phỏng vấn vào kênh Slack của nhóm tuyển dụng.

    Không bắt buộc cấu hình: thiếu `SLACK_WEBHOOK_URL` thì `notify` trả về
    False và `ConfirmedSlot.slack_notified` ghi lại đúng như vậy — lịch vẫn
    được đặt, email vẫn gửi. Thông báo Slack là kênh phụ, không phải điều kiện
    để đặt lịch thành công.
    """

    def __init__(self, app_timezone: str = "Asia/Ho_Chi_Minh") -> None:
        # Cùng múi giờ với EmailNotifier. Trước đây `notify` gọi `to_local_tz`
        # không tham số nên luôn dùng mặc định — đổi APP_TIMEZONE thì email đi
        # theo còn Slack thì không, và hai thông báo về CÙNG một cuộc phỏng vấn
        # ghi hai giờ khác nhau.
        self._app_timezone = app_timezone

    @property
    def timezone(self) -> str:
        return self._app_timezone

    async def notify(
        self,
        slot: ConfirmedSlot,
        candidate_name: str,
        interviewers: list[Interviewer],
        webhook_url: Optional[str],
    ) -> bool:
        if not webhook_url:
            # warning chứ không info: một cuộc phỏng vấn đã chốt mà nhóm tuyển
            # dụng không được báo là điều người vận hành cần thấy, không phải
            # một dòng log bình thường.
            logger.warning("scheduling.slack.no_webhook_url", slot_id=slot.id)
            return False

        interviewer_names = ", ".join([p.name for p in interviewers])
        local_start = to_local_tz(slot.start_time, self._app_timezone)
        payload = {
            "text": (
                f"Interview scheduled: *{candidate_name}* with "
                f"{interviewer_names} on "
                # %Z lấy tên múi giờ THẬT thay vì dán cứng "GMT+7": dán cứng
                # thì đổi APP_TIMEZONE sẽ in ra giờ đúng kèm nhãn sai.
                f"*{local_start.strftime('%b %d at %I:%M %p (%Z)')}* "
                f"({int((slot.end_time - slot.start_time).total_seconds() / 60)} min)"
            ),
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(webhook_url, json=payload)
                resp.raise_for_status()
            logger.info("scheduling.slack.notified", slot_id=slot.id)
            return True
        except Exception as e:
            logger.error(
                "scheduling.slack.failed",
                slot_id=slot.id,
                error=str(e),
            )
            return False
