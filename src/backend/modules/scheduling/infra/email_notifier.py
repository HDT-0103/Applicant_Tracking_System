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

    @property
    def enabled(self) -> bool:
        """Có gửi thư thật được không.

        Thiếu SMTP thì mọi hàm gửi vẫn chạy hết phần soạn nội dung và ghi log,
        nhưng KHÔNG gửi gì — và phải nói ra điều đó. Xem ghi chú ở
        `send_room_details`.
        """
        return bool(self._smtp_username and self._smtp_password)

    @property
    def timezone(self) -> str:
        """Múi giờ dùng cho mọi mốc thời gian trong thư.

        Là property vì `SchedulingService` cũng phải định dạng giờ theo đúng
        múi này; đọc `_app_timezone` từ bên ngoài thì cấu hình bị buộc chặt vào
        một chi tiết riêng tư của notifier.
        """
        return self._app_timezone

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
                subject = f"Interview Invitation: Congratulations {candidate_name}! - SmartATS"
                lines = [
                    f"Dear {candidate_name},",
                    "",
                    f"Congratulations {candidate_name}!",
                    "We are very pleased to inform you that your application has advanced to the interview stage at SmartATS.",
                    "",
                    "Your interview has been scheduled with the following details:",
                    f"• Candidate: {candidate_name}",
                    f"• Date: {local_start.strftime('%A, %B %d, %Y')}",
                    f"• Time: {local_start.strftime('%I:%M %p')} - {local_end.strftime('%I:%M %p')} (UTC+7)",
                    f"• Duration: {duration_minutes} minutes",
                    f"• Interview Panel: {interviewer_list}",
                    "• Location & Room: To be announced later",
                    "",
                    "Please note that the specific meeting room and location details (or online meeting link) will be announced in a follow-up notification prior to the interview.",
                    "",
                    "If you have any questions or require any assistance, please reply directly to this email.",
                    "",
                    "Best regards,",
                    "SmartATS Talent Acquisition Team",
                ]
                html_body = f"""
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <div style="margin-bottom: 20px;">
                        <h2 style="color: #2563eb; margin: 0 0 8px 0; font-size: 20px;">SmartATS Interview Invitation</h2>
                        <div style="font-size: 13px; color: #64748b;">Applicant Tracking &amp; Interview Management</div>
                    </div>
                    <p style="font-size: 15px; margin-bottom: 12px;">Dear <strong>{candidate_name}</strong>,</p>
                    <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 14px 18px; margin: 16px 0; border-radius: 4px;">
                        <p style="margin: 0; font-size: 16px; font-weight: 700; color: #065f46;">
                            🎉 Congratulations {candidate_name}!
                        </p>
                        <p style="margin: 6px 0 0 0; font-size: 14px; color: #047857;">
                            We are very pleased to inform you that your application has advanced to the interview stage at SmartATS.
                        </p>
                    </div>
                    <p style="font-size: 14px; color: #334155;">Your interview has been scheduled with the following details:</p>
                    <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 14px 18px; margin: 18px 0; border-radius: 4px; font-size: 14px;">
                        <p style="margin: 6px 0;"><strong>Candidate:</strong> {candidate_name}</p>
                        <p style="margin: 6px 0;"><strong>Date:</strong> {local_start.strftime('%A, %B %d, %Y')}</p>
                        <p style="margin: 6px 0;"><strong>Time:</strong> {local_start.strftime('%I:%M %p')} - {local_end.strftime('%I:%M %p')} <span style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; font-weight: 600; padding: 2px 6px; border-radius: 4px; font-size: 12px;">UTC+7</span></p>
                        <p style="margin: 6px 0;"><strong>Duration:</strong> {duration_minutes} minutes</p>
                        <p style="margin: 6px 0;"><strong>Interview Panel:</strong> {interviewer_list}</p>
                        <p style="margin: 6px 0;"><strong>Location &amp; Room:</strong> <em style="color: #64748b;">To be announced later</em></p>
                    </div>
                    <p style="font-size: 13px; color: #64748b; background-color: #f1f5f9; padding: 10px 14px; border-radius: 6px;">
                        ℹ️ <em>Please note that the specific meeting room and location details (or virtual conference link) will be announced in a follow-up notification prior to the interview.</em>
                    </p>
                    <p style="font-size: 14px; color: #334155;">If you have any questions or require any assistance, please feel free to reply directly to this email.</p>
                    <br/>
                    <p style="margin-bottom: 2px; font-size: 14px; color: #475569;">Best regards,</p>
                    <p style="margin-top: 0; font-weight: 700; color: #2563eb; font-size: 14px;">SmartATS Talent Acquisition Team</p>
                </div>
                """
            else:
                subject = f"Interview Scheduled: {candidate_name} - SmartATS"
                lines = [
                    "Hello,",
                    "",
                    f"An interview with candidate {candidate_name} has been scheduled successfully.",
                    "",
                    "Interview Schedule:",
                    f"• Date: {local_start.strftime('%A, %B %d, %Y')}",
                    f"• Time: {local_start.strftime('%I:%M %p')} - {local_end.strftime('%I:%M %p')} (UTC+7)",
                    f"• Duration: {duration_minutes} minutes",
                    f"• Interview Panel: {interviewer_list}",
                    "• Location & Room: To be announced later by the HR team",
                    "",
                    "Best regards,",
                    "SmartATS Scheduling System",
                ]
                html_body = f"""
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <div style="margin-bottom: 20px;">
                        <h2 style="color: #2563eb; margin: 0 0 8px 0; font-size: 20px;">Interview Scheduled</h2>
                        <div style="font-size: 13px; color: #64748b;">SmartATS Scheduling Notification</div>
                    </div>
                    <p style="font-size: 15px;">Hello,</p>
                    <p style="font-size: 14px; color: #334155;">An interview with candidate <strong>{candidate_name}</strong> has been scheduled successfully.</p>
                    <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 14px 18px; margin: 18px 0; border-radius: 4px; font-size: 14px;">
                        <p style="margin: 6px 0;"><strong>Date:</strong> {local_start.strftime('%A, %B %d, %Y')}</p>
                        <p style="margin: 6px 0;"><strong>Time:</strong> {local_start.strftime('%I:%M %p')} - {local_end.strftime('%I:%M %p')} <span style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; font-weight: 600; padding: 2px 6px; border-radius: 4px; font-size: 12px;">UTC+7</span></p>
                        <p style="margin: 6px 0;"><strong>Duration:</strong> {duration_minutes} minutes</p>
                        <p style="margin: 6px 0;"><strong>Interview Panel:</strong> {interviewer_list}</p>
                        <p style="margin: 6px 0;"><strong>Location &amp; Room:</strong> <em style="color: #64748b;">To be announced later by HR</em></p>
                    </div>
                    <br/>
                    <p style="margin-bottom: 2px; font-size: 14px; color: #475569;">Best regards,</p>
                    <p style="margin-top: 0; font-weight: 700; color: #2563eb; font-size: 14px;">SmartATS Scheduling System</p>
                </div>
                """
            
            body_text = "\n".join(lines)

            if self._smtp_username and self._smtp_password:
                try:
                    msg = MIMEMultipart("alternative")
                    msg["From"] = f"SmartATS HR <{self._from_email}>"
                    msg["To"] = email
                    msg["Subject"] = subject
                    msg.attach(MIMEText(body_text, "plain"))
                    msg.attach(MIMEText(html_body, "html"))

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
                # warning, không phải info: chưa cấu hình SMTP nghĩa là người
                # phỏng vấn KHÔNG nhận được thư mời nào cả.
                logger.warning(
                    "scheduling.email.not_configured",
                    to=email, slot_id=slot.id,
                    body=body_text,
                )
                return False

        return True

    async def send_room_details(
        self,
        candidate_name: str,
        candidate_email: str,
        slot_time: str,
        room: str,
        address: str,
    ) -> bool:
        subject = f"Interview Location & Room Details: {candidate_name} - SmartATS"
        lines = [
            f"Dear {candidate_name},",
            "",
            f"Hello {candidate_name}, here are the specific room and location details for your upcoming interview with SmartATS:",
            "",
            f"• Candidate: {candidate_name}",
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
        html_body = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="margin-bottom: 20px;">
                <h2 style="color: #2563eb; margin: 0 0 8px 0; font-size: 20px;">Interview Location &amp; Room Details</h2>
                <div style="font-size: 13px; color: #64748b;">SmartATS Interview Notification</div>
            </div>
            <p style="font-size: 15px;">Dear <strong>{candidate_name}</strong>,</p>
            <p style="font-size: 14px; color: #334155;">Here are the specific room and location details for your upcoming interview with SmartATS:</p>
            <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 14px 18px; margin: 18px 0; border-radius: 4px; font-size: 14px;">
                <p style="margin: 6px 0;"><strong>Candidate:</strong> {candidate_name}</p>
                <p style="margin: 6px 0;"><strong>Scheduled Time:</strong> {slot_time}</p>
                <p style="margin: 6px 0;"><strong>Meeting Room / Virtual Link:</strong> <span style="color: #2563eb; font-weight: 600;">{room}</span></p>
                <p style="margin: 6px 0;"><strong>Office Address / Instructions:</strong> {address}</p>
            </div>
            <p style="font-size: 13px; color: #64748b; background-color: #f1f5f9; padding: 10px 14px; border-radius: 6px;">
                ℹ️ <em>Please be ready 5 to 10 minutes prior to the start time. If you have any questions or require assistance, please feel free to reply to this email.</em>
            </p>
            <br/>
            <p style="margin-bottom: 2px; font-size: 14px; color: #475569;">Best regards,</p>
            <p style="margin-top: 0; font-weight: 700; color: #2563eb; font-size: 14px;">SmartATS Talent Acquisition Team</p>
        </div>
        """

        if self._smtp_username and self._smtp_password:
            try:
                msg = MIMEMultipart("alternative")
                msg["From"] = f"SmartATS HR <{self._from_email}>"
                msg["To"] = candidate_email
                msg["Subject"] = subject
                msg.attach(MIMEText(body_text, "plain"))
                msg.attach(MIMEText(html_body, "html"))

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
            # Trả về False chứ KHÔNG phải True.
            #
            # Trước đây nhánh này trả True, nên route báo với HR "Interview
            # details sent to <email>" trong khi không có thư nào rời khỏi máy
            # chủ. HR tin rằng ứng viên đã biết phòng và địa chỉ; ứng viên thì
            # không biết gì. Ghi log rồi báo thành công là kiểu hỏng tệ nhất —
            # nó không phân biệt được với thành công thật.
            logger.warning(
                "scheduling.email.not_configured",
                to=candidate_email, body=body_text,
            )
            return False
