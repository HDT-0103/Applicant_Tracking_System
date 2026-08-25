import zoneinfo
from datetime import datetime, timezone, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

import structlog

from modules.scheduling.domain.models import ConfirmedSlot, Interviewer

logger = structlog.get_logger(__name__)


def to_local_tz(dt: datetime, tz_name: str = "Asia/Ho_Chi_Minh") -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    try:
        tz = zoneinfo.ZoneInfo(tz_name)
    except Exception:
        tz = timezone(timedelta(hours=7))
    return dt.astimezone(tz)


class EmailNotifier:
    def __init__(
        self,
        smtp_host: str = "smtp.gmail.com",
        smtp_port: int = 587,
        smtp_username: str = "",
        smtp_password: str = "",
        from_email: str = "",
        app_timezone: str = "Asia/Ho_Chi_Minh",
    ) -> None:
        self._smtp_host = smtp_host
        self._smtp_port = smtp_port
        self._smtp_username = smtp_username
        self._smtp_password = smtp_password
        self._from_email = from_email or smtp_username
        self._app_timezone = app_timezone

    async def notify_interviewers(
        self,
        slot: ConfirmedSlot,
        candidate_name: str,
        interviewers: list[Interviewer],
        candidate_email: Optional[str] = None,
    ) -> bool:
        recipients = [p.email for p in interviewers if p.email]
        if candidate_email:
            recipients.append(candidate_email)

        if not recipients:
            logger.info("scheduling.email.no_recipients")
            return True

        interviewer_list = ", ".join([
            f"{p.name} ({'HR' if p.role.lower() == 'hr' else 'Tech Lead' if p.role.lower() == 'tech_lead' else p.role.replace('_', ' ').title()})"
            for p in interviewers if p.name
        ]) or "Technical Interview Team"
        duration_minutes = int((slot.end_time - slot.start_time).total_seconds() / 60)
        local_start = to_local_tz(slot.start_time, self._app_timezone)
        local_end = to_local_tz(slot.end_time, self._app_timezone)

        for email in recipients:
            if email == candidate_email:
                subject = f"Interview Invitation: {candidate_name} - SmartATS"
                lines = [
                    f"Dear {candidate_name},",
                    "",
                    "Congratulations! Following your application review, we are pleased to invite you for an interview with our team:",
                    "",
                    f"• Date: {local_start.strftime('%A, %B %d, %Y')}",
                    f"• Time: {local_start.strftime('%I:%M %p')} - {local_end.strftime('%I:%M %p')} (GMT+7)",
                    f"• Duration: {duration_minutes} minutes",
                    f"• Interview Panel: {interviewer_list}",
                    "",
                    "Additional details regarding the meeting room, location, or virtual conference link will be sent to you shortly.",
                    "",
                    "Best regards,",
                    "SmartATS Talent Acquisition Team",
                ]
            else:
                subject = f"Interview Scheduled: {candidate_name}"
                lines = [
                    "Hello,",
                    "",
                    f"An interview has been scheduled with {candidate_name}.",
                    "",
                    f"Date: {local_start.strftime('%A, %B %d, %Y')}",
                    f"Time: {local_start.strftime('%I:%M %p')} - {local_end.strftime('%I:%M %p')} (GMT+7)",
                    f"Duration: {duration_minutes} minutes",
                    "",
                    "Best regards,",
                    "SmartATS",
                ]
            
            body_text = "\n".join(lines)

            if self._smtp_username and self._smtp_password:
                try:
                    msg = MIMEMultipart("alternative")
                    msg["From"] = f"SmartATS HR <{self._from_email}>"
                    msg["To"] = email
                    msg["Subject"] = subject
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

    async def send_room_details(
        self,
        candidate_name: str,
        candidate_email: str,
        slot_time: str,
        room: str,
        address: str,
    ) -> bool:
        subject = f"Interview Location & Room Details - {candidate_name} - SmartATS"
        lines = [
            f"Dear {candidate_name},",
            "",
            "Here are the specific room and location details for your upcoming interview with SmartATS:",
            "",
            f"• Scheduled Time: {slot_time}",
            f"• Meeting Room / Virtual Link: {room}",
            f"• Office Address / Instructions: {address}",
            "",
            "Please be ready 5 to 10 minutes prior to the start time. If you have any questions or require assistance, please feel free to reply to this email.",
            "",
            "Best regards,",
            "SmartATS Talent Acquisition Team",
        ]
        body_text = "\n".join(lines)

        if self._smtp_username and self._smtp_password:
            try:
                msg = MIMEMultipart("alternative")
                msg["From"] = f"SmartATS HR <{self._from_email}>"
                msg["To"] = candidate_email
                msg["Subject"] = subject
                msg.attach(MIMEText(body_text, "plain"))

                with smtplib.SMTP(self._smtp_host, self._smtp_port) as server:
                    server.starttls()
                    server.login(self._smtp_username, self._smtp_password)
                    server.send_message(msg)

                logger.info("scheduling.email.room_details_sent", to=candidate_email)
                return True
            except Exception as e:
                logger.error("scheduling.email.room_details_failed", to=candidate_email, error=str(e))
                return False
        else:
            logger.info("scheduling.email.mock_room_details_sent", to=candidate_email, body=body_text)
            return True
