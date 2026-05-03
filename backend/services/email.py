import logging
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
            email=settings.BREVO_SENDER_EMAIL or "contact@brevo.com",
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


email_service = EmailService()
