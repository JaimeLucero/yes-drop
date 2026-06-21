"""
Supabase database client and repository for approval requests.
"""

import logging
from datetime import datetime, timezone
from supabase import create_client, Client
from core.config import settings

logger = logging.getLogger(__name__)

# Initialize Supabase client
if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
    logger.warning(
        "⚠️  Supabase credentials not configured. Database operations will fail."
    )
    supabase = None
else:
    try:
        supabase: Client = create_client(
            settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY
        )
        logger.info("✓ Supabase client initialized")
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        supabase = None


def to_response(record: dict) -> "ApprovalRequestResponse":
    """Convert database record to response schema"""
    from models.schemas import ApprovalRequestResponse

    # Get latest feedback if request is approved or rejected
    feedback = None
    if record["status"] in ("approved", "rejected"):
        feedback_records = repository.get_feedback(record["id"])
        if feedback_records:
            feedback = feedback_records[0].get("feedback_text")

    # Get email events if request has been sent
    viewed_at = None
    view_count = 0
    if record["status"] in ("pending", "approved", "rejected"):
        email_events = repository.get_email_events(record["id"])
        view_count = len(email_events)
        if email_events:
            viewed_at = email_events[0].get("created_at")

    return ApprovalRequestResponse(
        id=record["id"],
        user_id=record["user_id"],
        requester_email=record.get("requester_email"),
        approver_email=record.get("approver_email"),
        title=record.get("title"),
        message=record.get("message"),
        file_url=record.get("file_url"),
        feedback=feedback,
        viewed_at=viewed_at,
        view_count=view_count,
        token=record["token"],
        status=record["status"],
        scheduled_send_at=record.get("scheduled_send_at"),
        sent_at=record.get("sent_at"),
        deadline=record.get("deadline"),
        deadline_days=record.get("deadline_days"),
        follow_up_strategy=record.get("follow_up_strategy"),
        created_at=record["created_at"],
        updated_at=record["updated_at"],
    )


class ApprovalRequestRepository:
    """Repository for approval request database operations"""

    @staticmethod
    def create(record: dict) -> dict:
        """Create a new approval request"""
        result = supabase.table("approval_requests").insert(record).execute()
        return result.data[0]

    @staticmethod
    def get_by_id(request_id: str) -> dict | None:
        """Get request by ID"""
        result = (
            supabase.table("approval_requests")
            .select("*")
            .eq("id", request_id)
            .execute()
        )
        return result.data[0] if result.data else None

    @staticmethod
    def get_by_token(token: str) -> dict | None:
        """Get request by token"""
        result = (
            supabase.table("approval_requests").select("*").eq("token", token).execute()
        )
        return result.data[0] if result.data else None

    @staticmethod
    def get_by_user(user_id: str, status: str | None = None) -> list[dict]:
        """Get all requests for a user, optionally filtered by status"""
        query = supabase.table("approval_requests").select("*").eq("user_id", user_id)

        if status:
            query = query.eq("status", status)

        query = query.order("created_at", desc=True)
        result = query.execute()
        return result.data or []

    @staticmethod
    def get_scheduled_due() -> list[dict]:
        """Get all scheduled requests that are due to be sent"""
        now = datetime.now(timezone.utc).isoformat()
        try:
            result = (
                supabase.table("approval_requests")
                .select("*")
                .eq("status", "scheduled")
                .lte("scheduled_send_at", now)
                .order("scheduled_send_at", desc=False)
                .execute()
            )
            requests = result.data or []
            logger.debug(
                f"Scheduler check: NOW={now}, Found {len(requests)} scheduled request(s) due"
            )
            for req in requests:
                logger.debug(
                    f"  - {req['id']}: scheduled_send_at={req.get('scheduled_send_at')}"
                )
            return requests
        except Exception as e:
            logger.error(f"Error getting scheduled requests: {e}", exc_info=True)
            return []

    @staticmethod
    def update(request_id: str, data: dict) -> dict | None:
        """Update a request"""
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        result = (
            supabase.table("approval_requests")
            .update(data)
            .eq("id", request_id)
            .execute()
        )
        return result.data[0] if result.data else None

    @staticmethod
    def delete(request_id: str) -> bool:
        """Delete a request"""
        result = (
            supabase.table("approval_requests").delete().eq("id", request_id).execute()
        )
        return (result.count or 0) > 0

    @staticmethod
    def get_daily_sent_count(user_id: str) -> int:
        """Get count of sent requests today (UTC)"""
        try:
            result = supabase.rpc(
                "get_daily_sent_count", {"user_uuid": user_id}
            ).execute()
            return result.data if result.data else 0
        except Exception as e:
            logger.error(f"Error getting daily count: {e}")
            return 0

    @staticmethod
    def get_next_available_day(user_id: str) -> str | None:
        """Get next available day for sending (has < 5 requests)"""
        try:
            result = supabase.rpc(
                "get_next_available_day", {"user_uuid": user_id}
            ).execute()
            return result.data if result.data else None
        except Exception as e:
            logger.error(f"Error getting next available day: {e}")
            return None

    @staticmethod
    def add_feedback(
        request_id: str, approver_email: str, feedback_text: str
    ) -> dict | None:
        """Add feedback to a request"""
        try:
            result = (
                supabase.table("request_feedback")
                .insert(
                    {
                        "request_id": request_id,
                        "approver_email": approver_email,
                        "feedback_text": feedback_text,
                    }
                )
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error adding feedback: {e}")
            return None

    @staticmethod
    def get_feedback(request_id: str) -> list[dict]:
        """Get all feedback for a request"""
        try:
            result = (
                supabase.table("request_feedback")
                .select("*")
                .eq("request_id", request_id)
                .order("created_at", desc=True)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Error getting feedback: {e}")
            return []

    @staticmethod
    def log_email_event(
        request_id: str, ip_address: str | None, user_agent: str | None
    ) -> dict | None:
        """Log an email open event"""
        try:
            result = (
                supabase.table("request_email_events")
                .insert(
                    {
                        "request_id": request_id,
                        "event_type": "open",
                        "ip_address": ip_address,
                        "user_agent": user_agent,
                    }
                )
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error logging email event: {e}")
            return None

    @staticmethod
    def get_email_events(request_id: str) -> list[dict]:
        """Get all email events for a request"""
        try:
            result = (
                supabase.table("request_email_events")
                .select("*")
                .eq("request_id", request_id)
                .order("created_at", desc=False)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Error getting email events: {e}")
            return []

    @staticmethod
    def add_email_event(request_id: str, event_type: str) -> dict | None:
        """Add an email event (e.g., follow-up sent)"""
        try:
            result = (
                supabase.table("request_email_events")
                .insert(
                    {
                        "request_id": request_id,
                        "event_type": event_type,
                    }
                )
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error adding email event: {e}")
            return None

    @staticmethod
    def get_requests_past_deadline() -> list[dict]:
        """Get all pending requests past their deadline"""
        try:
            result = supabase.rpc("get_requests_past_deadline").execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error getting requests past deadline: {e}")
            return []

    @staticmethod
    def get_requests_due_for_followup_before_deadline() -> list[dict]:
        """Get requests due for follow-up before deadline"""
        try:
            result = supabase.rpc(
                "get_requests_due_for_followup_before_deadline"
            ).execute()
            return result.data or []
        except Exception as e:
            logger.error(
                f"Error getting requests due for before-deadline follow-up: {e}"
            )
            return []

    @staticmethod
    def get_requests_due_for_followup_after_sending() -> list[dict]:
        """Get requests due for follow-up after sending"""
        try:
            result = supabase.rpc(
                "get_requests_due_for_followup_after_sending"
            ).execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error getting requests due for after-sending follow-up: {e}")
            return []

    @staticmethod
    def get_public_stats() -> dict:
        """Global aggregate stats for the public landing page."""
        try:
            result = supabase.rpc("get_public_stats").execute()
            return result.data or {}
        except Exception as e:
            logger.error(f"Error getting public stats: {e}")
            return {}

    @staticmethod
    def get_user_stats(user_id: str) -> dict:
        """Per-user aggregate stats for the dashboard analytics band."""
        try:
            result = supabase.rpc(
                "get_user_stats", {"user_uuid": user_id}
            ).execute()
            return result.data or {}
        except Exception as e:
            logger.error(f"Error getting user stats: {e}")
            return {}

    # ---- Reminders (follow-up automation) ----

    @staticmethod
    def create_reminders(request_id: str, reminders: list[dict]) -> None:
        """Insert reminder rows for a request."""
        if not reminders:
            return
        rows = [
            {
                "request_id": request_id,
                "kind": r["kind"],
                "send_at": r["send_at"],
                "custom_message": r.get("custom_message"),
            }
            for r in reminders
        ]
        try:
            supabase.table("request_reminders").insert(rows).execute()
        except Exception as e:
            logger.error(f"Error creating reminders: {e}")

    @staticmethod
    def cancel_pending_reminders(request_id: str) -> None:
        """Cancel all pending reminders for a request (used on reschedule)."""
        try:
            (
                supabase.table("request_reminders")
                .update({"status": "cancelled"})
                .eq("request_id", request_id)
                .eq("status", "pending")
                .execute()
            )
        except Exception as e:
            logger.error(f"Error cancelling reminders: {e}")

    @staticmethod
    def get_due_reminders() -> list[dict]:
        """Pending reminders that are due and whose parent is still pending."""
        try:
            result = supabase.rpc("get_due_reminders").execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error getting due reminders: {e}")
            return []

    @staticmethod
    def get_reminder(reminder_id: str) -> dict | None:
        """Get a single reminder row by id."""
        try:
            result = (
                supabase.table("request_reminders")
                .select("*")
                .eq("id", reminder_id)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error getting reminder: {e}")
            return None

    @staticmethod
    def mark_reminder_sent(reminder_id: str) -> None:
        """Flip a reminder to 'sent' so it never re-fires (dedup)."""
        try:
            (
                supabase.table("request_reminders")
                .update(
                    {
                        "status": "sent",
                        "sent_at": datetime.now(timezone.utc).isoformat(),
                    }
                )
                .eq("id", reminder_id)
                .execute()
            )
        except Exception as e:
            logger.error(f"Error marking reminder sent: {e}")


# Singleton instance
repository = ApprovalRequestRepository()
