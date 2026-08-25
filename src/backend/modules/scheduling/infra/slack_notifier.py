from typing import Optional

import httpx
import structlog

from modules.scheduling.domain.models import ConfirmedSlot, Interviewer
from modules.scheduling.infra.email_notifier import to_local_tz

logger = structlog.get_logger(__name__)


class SlackNotifier:
    async def notify(
        self,
        slot: ConfirmedSlot,
        candidate_name: str,
        interviewers: list[Interviewer],
        webhook_url: Optional[str],
    ) -> bool:
        if not webhook_url:
            logger.info("scheduling.slack.no_webhook_url")
            return False

        interviewer_names = ", ".join([p.name for p in interviewers])
        local_start = to_local_tz(slot.start_time)
        payload = {
            "text": (
                f"Interview scheduled: *{candidate_name}* with "
                f"{interviewer_names} on "
                f"*{local_start.strftime('%b %d at %I:%M %p (GMT+7)')}* "
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
