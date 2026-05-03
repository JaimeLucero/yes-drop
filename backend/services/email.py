import logging
from datetime import datetime
from brevo import (
    Brevo,
    SendTransacEmailRequestSender,
    SendTransacEmailRequestToItem,
    SendTransacEmailRequestReplyTo,
)

from core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    def __init__(self):
        self.api = Brevo(api_key=settings.BREVO_API_KEY or "")

    async def send_approval_request(
        self,
        to_email: str,
        request_title: str,
        requester_email: str,
        html_content: str,
    ) -> bool:
        """Send approval request email via Brevo"""
        if not settings.BREVO_API_KEY:
            logger.warning("BREVO_API_KEY not configured, skipping email send")
            return False

        sender = SendTransacEmailRequestSender(
            name=settings.BREVO_SENDER_NAME,
            email=settings.BREVO_SENDER_EMAIL or "noreply@yesdrop.online",
        )

        to = [SendTransacEmailRequestToItem(email=to_email)]

        reply_to = SendTransacEmailRequestReplyTo(
            name="Requester",
            email=requester_email,
        )

        try:
            response = self.api.transactional_emails.send_transac_email(
                sender=sender,
                to=to,
                reply_to=reply_to,
                subject=f"Approval Request: {request_title}",
                html_content=html_content,
            )
            logger.info(f"Email sent successfully, messageId: {response.message_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False

    async def send_status_notification(
        self,
        to_email: str,
        request_title: str,
        old_status: str,
        new_status: str,
        scheduled_time: str | None = None,
    ) -> bool:
        """Send status change notification to requester"""
        if not settings.BREVO_API_KEY:
            return False

        sender = SendTransacEmailRequestSender(
            name="YesDrop",
            email="noreply@yesdrop.online",
        )

        to = [SendTransacEmailRequestToItem(email=to_email)]

        # Email templates based on status transition
        templates = {
            ("draft", "scheduled"): {
                "subject": f"Request Scheduled: {request_title}",
                "html": f"""
                <html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Request Scheduled</h2>
                    <p>Your request "<strong>{request_title}</strong>" has been scheduled.</p>
                    <p><strong>Scheduled for:</strong> {scheduled_time}</p>
                    <p>You can edit or reschedule this request from your dashboard.</p>
                </body></html>
                """,
            },
            ("draft", "pending"): {
                "subject": f"Request Sent: {request_title}",
                "html": f"""
                <html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Request Sent</h2>
                    <p>Your request "<strong>{request_title}</strong>" has been sent to the approver.</p>
                    <p>You'll be notified when they respond.</p>
                </body></html>
                """,
            },
            ("scheduled", "pending"): {
                "subject": f"Request Sent: {request_title}",
                "html": f"""
                <html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Request Sent Successfully</h2>
                    <p>Your scheduled request "<strong>{request_title}</strong>" was sent.</p>
                    <p>You'll be notified when the approver responds.</p>
                </body></html>
                """,
            },
            ("pending", "approved"): {
                "subject": f"Request Approved! 🎉",
                "html": f"""
                <html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #22c55e;">Request Approved!</h2>
                    <p>Great news! Your request "<strong>{request_title}</strong>" was approved.</p>
                </body></html>
                """,
            },
            ("pending", "rejected"): {
                "subject": f"Request Update: {request_title}",
                "html": f"""
                <html><body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #ef4444;">Request Update</h2>
                    <p>Your request "<strong>{request_title}</strong>" was rejected by the approver.</p>
                    <p>You can create a new request or edit this one if needed.</p>
                </body></html>
                """,
            },
        }

        template = templates.get((old_status, new_status))
        if not template:
            return False

        try:
            response = self.api.transactional_emails.send_transac_email(
                sender=sender,
                to=to,
                subject=template["subject"],
                html_content=template["html"],
            )
            logger.info(f"Status notification sent: {new_status}")
            return True
        except Exception as e:
            logger.error(f"Failed to send status notification: {e}")
            return False


email_service = EmailService()
