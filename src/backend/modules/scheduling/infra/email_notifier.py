import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

import structlog

from modules.scheduling.domain.models import ConfirmedSlot, Interviewer

logger = structlog.get_logger(__name__)


class EmailNotifier:
    def __init__(
        self,
        smtp_host: str = "smtp.gmail.com",
        smtp_port: int = 587,
        smtp_username: str = "",
        smtp_password: str = "",
        from_email: str = "",
    ) -> None:
        self._smtp_host = smtp_host
        self._smtp_port = smtp_port
        self._smtp_username = smtp_username
        self._smtp_password = smtp_password
        self._from_email = from_email or smtp_username

    async def notify_interviewers(
        self,
        slot: ConfirmedSlot,
        candidate_name: str,
        interviewers: list[Interviewer],
    ) -> bool:
        recipients = [p for p in interviewers if p.email]
        if not recipients:
            logger.info("scheduling.email.no_recipients")
            return True

        for recipient in recipients:
            email = recipient.email
            lines = [
                f"Hello {recipient.name},",
                "",
                f"An interview has been scheduled with {candidate_name}.",
                "",
                f"Date: {slot.start_time.strftime('%A, %B %d, %Y')}",
                f"Time: {slot.start_time.strftime('%I:%M %p')} - {slot.end_time.strftime('%I:%M %p')} (UTC)",
                f"Duration: {int((slot.end_time - slot.start_time).total_seconds() / 60)} minutes",
                "",
                "Best regards,",
                "SmartATS",
            ]
            body_text = "\n".join(lines)

            if self._smtp_username and self._smtp_password:
                try:
                    msg = MIMEMultipart("alternative")
                    msg["From"] = self._from_email
                    msg["To"] = email
                    msg["Subject"] = f"Interview Scheduled: {candidate_name}"
                    msg.attach(MIMEText(body_text, "plain"))

                    with smtplib.SMTP(self._smtp_host, self._smtp_port) as server:
                        server.starttls()
                        server.login(self._smtp_username, self._smtp_password)
                        server.send_message(msg)

                    logger.info("scheduling.email.sent", to=email, slot_id=slot.id)
                except Exception as e:
                    logger.error(
                        "scheduling.email.failed",
                        to=email, slot_id=slot.id, error=str(e),
                    )
                    return False
            else:
                logger.info(
                    "scheduling.email.mock_sent",
                    to=email, slot_id=slot.id,
                    body=body_text,
                )

        return True
