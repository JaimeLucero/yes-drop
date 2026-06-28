"""
Business logic for approval requests.
"""

import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import HTTPException

from services.database import repository, to_response, supabase
from services.email import email_service
from core.config import settings
from models.schemas import (
    ApprovalRequestCreate,
    ApprovalRequestDraft,
    ApprovalRequestUpdate,
    ApprovalRequestResponse,
    DailyLimitResponse,
)

logger = logging.getLogger(__name__)


async def get_user_email(user_id: str) -> Optional[str]:
    """Fetch user's email from Supabase Auth"""
    try:
        # Query the auth.users table via RPC or direct query
        result = supabase.rpc("get_user_email", {"user_uuid": user_id}).execute()
        if result.data:
            return result.data
        return None
    except Exception as e:
        logger.error(f"Error fetching user email: {e}")
        return None


# Max approval requests a user can send per day.
DAILY_REQUEST_LIMIT = 15


def get_daily_limit_info(user_id: str) -> tuple[int, datetime, str | None]:
    """Get daily usage info using Supabase RPC functions"""
    try:
        # Get daily count
        count = repository.get_daily_sent_count(user_id)

        # Calculate reset time (midnight UTC)
        now_utc = datetime.now(timezone.utc)
        tomorrow_utc = (now_utc + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        # Get next available date
        next_available = repository.get_next_available_day(user_id)

        return count, tomorrow_utc, next_available
    except Exception as e:
        logger.error(f"Error getting daily limit: {e}")
        # Fallback to 0 if RPC fails
        now_utc = datetime.now(timezone.utc)
        tomorrow_utc = (now_utc + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        return 0, tomorrow_utc, None


def _humanize_hours(hours: float) -> str:
    """Human-friendly duration for a positive number of hours."""
    if hours < 1.5:
        return "1 hour"
    if hours < 36:
        return f"{round(hours)} hours"
    return f"{round(hours / 24)} days"


def _humanize_since(delta: timedelta) -> str:
    """Human-friendly 'ago' phrasing for an elapsed timedelta."""
    total_hours = delta.total_seconds() / 3600
    if total_hours < 1.5:
        return "less than an hour"
    if total_hours < 36:
        return f"{round(total_hours)} hours"
    return f"{round(total_hours / 24)} days"


async def send_approval_email(
    record: dict, is_followup: bool = False, reminder: dict | None = None
):
    """Send approval request email via Brevo.

    When ``is_followup`` is set, ``reminder`` (a request_reminders row or the
    get_due_reminders projection) drives the subject prefix and urgency banner,
    which are computed dynamically from the live time window — no hardcoded
    day values, so any reminder schedule renders correct copy.
    """
    approve_url = (
        f"{settings.FRONTEND_URL}/action?token={record['token']}&action=approve"
    )
    reject_url = f"{settings.FRONTEND_URL}/action?token={record['token']}&action=reject"

    requester_display = record.get("requester_email", record["user_id"][:8])
    # A reminder may override the body copy with its own custom message.
    body_text = (reminder or {}).get("custom_message") or record.get("message")
    message_section = (
        f'<p style="color: #666; font-size: 15px; line-height: 1.6; margin: 16px 0;">{body_text}</p>'
        if body_text
        else ""
    )
    file_section = (
        f'<p style="margin: 16px 0;"><a href="{record["file_url"]}" style="color: #0066cc; text-decoration: none; font-weight: 500;">📎 View attached file</a></p>'
        if record.get("file_url")
        else ""
    )

    # Format deadline date
    deadline_str = ""
    if record.get("deadline"):
        deadline_dt = (
            datetime.fromisoformat(record["deadline"].replace("Z", "+00:00"))
            if isinstance(record["deadline"], str)
            else record["deadline"]
        )
        deadline_str = deadline_dt.strftime("%B %d, %Y at %I:%M %p UTC")

    # Parse sent_at for after-sending follow-up phrasing
    sent_dt = None
    if record.get("sent_at"):
        sent_dt = (
            datetime.fromisoformat(record["sent_at"].replace("Z", "+00:00"))
            if isinstance(record["sent_at"], str)
            else record["sent_at"]
        )

    # Tracking pixel for email opens
    tracking_pixel = f'<img src="{settings.BACKEND_URL}/track/open?token={record["token"]}" width="1" height="1" alt="" style="display:none;opacity:0;" />'

    # Subject line and urgency banner are computed dynamically from the live
    # time window so any reminder schedule renders correct copy.
    subject_prefix = ""
    urgency_banner = ""
    if is_followup:
        kind = (reminder or {}).get("kind") or "after_sending"
        now = datetime.now(timezone.utc)

        if kind == "before_deadline":
            subject_prefix = "[Reminder] "
            headline = "Reminder: your response is needed"
            if deadline_str and deadline_dt:
                hours_left = (deadline_dt - now).total_seconds() / 3600
                if hours_left > 0:
                    headline = (
                        f"Reminder: response needed within {_humanize_hours(hours_left)}"
                    )
            detail = (
                f"This request expires on {deadline_str}"
                if deadline_str
                else "Please respond soon"
            )
        else:  # after_sending / absolute
            subject_prefix = "[Follow-up] "
            headline = "Follow-up: this request is awaiting your response"
            detail = ""
            if sent_dt:
                detail = f"Sent {_humanize_since(now - sent_dt)} ago"
            if deadline_str:
                detail = (detail + " • " if detail else "") + f"Expires on {deadline_str}"
            if not detail:
                detail = "Awaiting your response"

        urgency_banner = f"""
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                <p style="color: #92400e; margin: 0; font-size: 14px; font-weight: 600;">⏰ {headline}</p>
                <p style="color: #92400e; margin: 4px 0 0 0; font-size: 13px;">{detail}</p>
            </div>
            """

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px 0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 0 24px;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">YesDrop</h1>
                <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0 0; font-size: 14px;">Approval request from {requester_display}</p>
            </div>
        </div>

        <div style="max-width: 600px; margin: 0 auto; padding: 40px 24px;">
            {urgency_banner}
            <div style="background: #f9fafb; border-left: 4px solid #667eea; padding: 20px; border-radius: 4px; margin-bottom: 32px;">
                <h2 style="color: #1f2937; margin: 0 0 8px 0; font-size: 20px; font-weight: 600;">{record["title"]}</h2>
                <p style="color: #6b7280; margin: 0; font-size: 13px;">Needs your approval</p>
            </div>

            {message_section}
            {file_section}

            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin: 32px 0;">
                <p style="color: #6b7280; font-size: 13px; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">What do you want to do?</p>
                <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                    <a href="{approve_url}" style="flex: 1; display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; text-align: center; font-size: 14px; transition: background 0.2s;">✓ Approve</a>
                    <a href="{reject_url}" style="flex: 1; display: inline-block; background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; text-align: center; font-size: 14px; transition: background 0.2s;">✗ Reject</a>
                </div>
                <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">Or reply to this email to provide feedback</p>
            </div>

            <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
                    Please respond by <strong>{deadline_str}</strong> or this request will be marked as ignored.<br/>
                    <a href="{settings.FRONTEND_URL}/dashboard" style="color: #667eea; text-decoration: none;">View all requests on YesDrop</a>
                </p>
            </div>
        </div>

        <div style="background: #f3f4f6; padding: 24px 0; text-align: center; border-top: 1px solid #e5e7eb; margin-top: 32px;">
            <p style="color: #6b7280; font-size: 12px; margin: 0; max-width: 600px; margin-left: auto; margin-right: auto; padding: 0 24px;">
                YesDrop makes approval requests simple and seamless.<br/>
                <a href="https://yesdrop.online" style="color: #667eea; text-decoration: none;">Learn more</a>
            </p>
        </div>

        {tracking_pixel}
    </body>
    </html>
    """

    await email_service.send_approval_request(
        to_email=record["approver_email"],
        request_title=record["title"],
        requester_email=record.get("requester_email") or "noreply@em.yesdrop.online",
        html_content=html,
        subject_prefix=subject_prefix,
    )


class ApprovalRequestService:
    """Service for approval request business logic"""

    @staticmethod
    async def create_request(
        request: ApprovalRequestCreate, user_id: str
    ) -> ApprovalRequestResponse:
        """Create a new request (immediate send or scheduled)"""
        # Fetch user's email from Supabase Auth
        requester_email = await get_user_email(user_id)

        # Check daily limit only if sending immediately
        if not request.scheduled_send_at:
            count, reset_time, _ = get_daily_limit_info(user_id)
            if count >= DAILY_REQUEST_LIMIT:
                raise HTTPException(
                    400,
                    detail={
                        "message": f"Daily limit reached ({DAILY_REQUEST_LIMIT} requests/day)",
                        "resets_at": reset_time.isoformat(),
                        "suggestion": "Consider scheduling for tomorrow or save as draft",
                    },
                )

        token = secrets.token_urlsafe(32)
        req_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        # Determine status and scheduled time
        if request.scheduled_send_at:
            status = "scheduled"
            scheduled_dt = datetime.fromisoformat(
                request.scheduled_send_at.replace("Z", "+00:00")
            )
            # Ensure timezone-aware comparison
            if scheduled_dt.tzinfo is None:
                scheduled_dt = scheduled_dt.replace(tzinfo=timezone.utc)
            if scheduled_dt <= now:
                raise HTTPException(400, "scheduled_send_at must be in the future")
        else:
            status = "pending"
            scheduled_dt = None

        # Prepare record
        deadline = (
            now + timedelta(days=request.deadline_days) if status == "pending" else None
        )
        follow_up_dict = (
            request.follow_up_strategy.model_dump()
            if request.follow_up_strategy
            else {"enabled": True, "days_before_deadline": 1}
        )
        record = {
            "id": req_id,
            "user_id": user_id,
            "requester_email": requester_email,
            "approver_email": request.approver_email,
            "title": request.title,
            "message": request.message,
            "file_url": request.file_url,
            "token": token,
            "status": status,
            "scheduled_send_at": scheduled_dt.isoformat() if scheduled_dt else None,
            "sent_at": now.isoformat() if status == "pending" else None,
            "deadline": deadline.isoformat() if deadline else None,
            "deadline_days": request.deadline_days,
            "follow_up_strategy": follow_up_dict,
            "notify_requester": request.notify_requester,
        }

        # Insert into database
        created = repository.create(record)

        # Persist reminders. They only fire once the parent request is pending
        # (get_due_reminders joins on approval_requests.status = 'pending').
        if request.reminders:
            repository.create_reminders(
                req_id, [r.model_dump() for r in request.reminders]
            )

        # Send email only if sending immediately
        if status == "pending":
            try:
                await send_approval_email(created)
            except Exception as e:
                logger.error(
                    f"Failed to send approval email for request {req_id}: {e}",
                    exc_info=True,
                )

            # Send notification to requester
            if request.notify_requester and requester_email:
                try:
                    await email_service.send_status_notification(
                        to_email=requester_email,
                        request_title=request.title,
                        old_status="draft",
                        new_status="pending",
                    )
                except Exception as e:
                    logger.error(
                        f"Failed to send status notification for request {req_id}: {e}",
                        exc_info=True,
                    )

        return to_response(created)

    @staticmethod
    async def create_draft(
        request: ApprovalRequestDraft, user_id: str
    ) -> ApprovalRequestResponse:
        """Create a draft request (not sent, no daily limit check)"""
        req_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        record = {
            "id": req_id,
            "user_id": user_id,
            "approver_email": request.approver_email,
            "title": request.title,
            "message": request.message,
            "file_url": request.file_url,
            "token": secrets.token_urlsafe(32),
            "status": "draft",
            "scheduled_send_at": None,
            "sent_at": None,
            "notify_requester": True,
        }

        created = repository.create(record)
        return to_response(created)

    @staticmethod
    async def schedule_request(
        request_id: str, data: dict, user_id: str
    ) -> ApprovalRequestResponse:
        """Schedule a draft for sending"""
        logger.info(f"Starting schedule_request for {request_id}")

        req = repository.get_by_id(request_id)
        logger.info(f"Retrieved request: {req}")
        if not req:
            logger.error(f"Request not found: {request_id}")
            raise HTTPException(404, "Request not found")

        if req["user_id"] != user_id:
            logger.error(f"User {user_id} does not own request {request_id}")
            raise HTTPException(404, "Request not found")

        if req["status"] not in ("draft", "scheduled"):
            logger.error(
                f"Request {request_id} status is {req['status']}, cannot schedule"
            )
            raise HTTPException(403, "Only drafts can be scheduled")

        now = datetime.now(timezone.utc)

        # Parse scheduled time (expects UTC ISO string from frontend)
        try:
            logger.info(f"Parsing scheduled_send_at: {data.get('scheduled_send_at')}")
            scheduled_dt = datetime.fromisoformat(
                data["scheduled_send_at"].replace("Z", "+00:00")
            )
            logger.info(f"Parsed scheduled_dt (UTC): {scheduled_dt}")
            logger.info(f"Current server time (UTC): {now}")
        except KeyError as e:
            logger.error(f"Missing key in data: {e}", exc_info=True)
            raise HTTPException(400, f"Missing field: {str(e)}")
        except (ValueError, AttributeError) as e:
            logger.error(
                f"Invalid scheduled_send_at format: {data.get('scheduled_send_at')}, error: {e}",
                exc_info=True,
            )
            raise HTTPException(400, f"Invalid datetime format: {str(e)}")

        if scheduled_dt <= now:
            logger.error(
                f"scheduled_dt {scheduled_dt} is not in the future (now: {now})"
            )
            raise HTTPException(400, "scheduled_send_at must be in the future")

        # Update request
        update_data = {
            "status": "scheduled",
            "scheduled_send_at": scheduled_dt.isoformat(),
            "updated_at": now.isoformat(),
        }

        # Add deadline and follow-up settings if provided
        if data.get("deadline_days"):
            update_data["deadline_days"] = data["deadline_days"]
        if data.get("follow_up_strategy"):
            update_data["follow_up_strategy"] = data["follow_up_strategy"]

        logger.info(f"Updating request {request_id} with: {update_data}")

        updated = repository.update(request_id, update_data)
        logger.info(f"Updated request: {updated}")

        # Replace reminders for this request (cancel old pending, insert new).
        if data.get("reminders") is not None:
            repository.cancel_pending_reminders(request_id)
            repository.create_reminders(request_id, data["reminders"])

        # Send notification using stored requester email
        requester_email = req.get("requester_email")
        if requester_email:
            try:
                await email_service.send_status_notification(
                    to_email=requester_email,
                    request_title=req["title"] or "Untitled",
                    old_status="draft",
                    new_status="scheduled",
                    scheduled_time=scheduled_dt.strftime("%B %d, %Y at %I:%M %p UTC"),
                )
            except Exception as e:
                logger.error(f"Failed to send status notification: {e}", exc_info=True)

        return to_response(updated)

    @staticmethod
    async def send_request_now(
        request_id: str, user_id: str
    ) -> ApprovalRequestResponse:
        """Send a draft immediately"""
        req = repository.get_by_id(request_id)
        if not req:
            raise HTTPException(404, "Request not found")

        if req["user_id"] != user_id:
            raise HTTPException(404, "Request not found")

        if req["status"] not in ("draft", "scheduled"):
            raise HTTPException(403, "Only drafts can be sent")

        # Check daily limit
        count, reset_time, _ = get_daily_limit_info(user_id)
        if count >= DAILY_REQUEST_LIMIT:
            raise HTTPException(
                400,
                detail={
                    "message": f"Daily limit reached ({DAILY_REQUEST_LIMIT} requests/day)",
                    "resets_at": reset_time.isoformat(),
                },
            )

        # Update status and send email
        now = datetime.now(timezone.utc)
        deadline_days = req.get("deadline_days", 3)
        deadline = now + timedelta(days=deadline_days)
        update_data = {
            "status": "pending",
            "sent_at": now.isoformat(),
            "deadline": deadline.isoformat(),
            "deadline_days": deadline_days,
            "follow_up_strategy": req.get(
                "follow_up_strategy", {"enabled": True, "days_before_deadline": 1}
            ),
            "updated_at": now.isoformat(),
        }

        updated = repository.update(request_id, update_data)

        try:
            await send_approval_email(updated)
        except Exception as e:
            logger.error(
                f"Failed to send approval email for request {request_id}: {e}",
                exc_info=True,
            )

        # Send notification to requester using stored email
        requester_email = req.get("requester_email")
        if requester_email:
            try:
                await email_service.send_status_notification(
                    to_email=requester_email,
                    request_title=req["title"] or "Untitled",
                    old_status=req["status"],
                    new_status="pending",
                )
            except Exception as e:
                logger.error(
                    f"Failed to send status notification for request {request_id}: {e}",
                    exc_info=True,
                )

        return to_response(updated)

    @staticmethod
    async def update_request(
        request_id: str, update_data: ApprovalRequestUpdate, user_id: str
    ) -> ApprovalRequestResponse:
        """Update a draft or scheduled request"""
        req = repository.get_by_id(request_id)
        if not req:
            raise HTTPException(404, "Request not found")

        if req["user_id"] != user_id:
            raise HTTPException(404, "Request not found")

        if req["status"] not in ("draft", "scheduled"):
            raise HTTPException(403, "Only drafts and scheduled requests can be edited")

        # Build update payload
        payload = {"updated_at": datetime.now(timezone.utc).isoformat()}
        if update_data.approver_email is not None:
            payload["approver_email"] = update_data.approver_email
        if update_data.title is not None:
            payload["title"] = update_data.title
        if update_data.message is not None:
            payload["message"] = update_data.message
        if update_data.file_url is not None:
            payload["file_url"] = update_data.file_url
        if update_data.scheduled_send_at is not None:
            payload["scheduled_send_at"] = datetime.fromisoformat(
                update_data.scheduled_send_at.replace("Z", "+00:00")
            ).isoformat()

        updated = repository.update(request_id, payload)
        return to_response(updated)

    @staticmethod
    async def delete_request(request_id: str, user_id: str) -> dict:
        """Delete a draft or scheduled request"""
        req = repository.get_by_id(request_id)
        if not req:
            raise HTTPException(404, "Request not found")

        if req["user_id"] != user_id:
            raise HTTPException(404, "Request not found")

        if req["status"] not in ("draft", "scheduled"):
            raise HTTPException(
                403, "Only drafts and scheduled requests can be deleted"
            )

        repository.delete(request_id)
        return {"message": "Request deleted successfully"}

    @staticmethod
    def list_requests(
        user_id: str, status: str | None = None
    ) -> list[ApprovalRequestResponse]:
        """List user's requests with optional status filter"""
        records = repository.get_by_user(user_id, status)
        return [to_response(r) for r in records]

    @staticmethod
    def get_daily_limit(user_id: str) -> DailyLimitResponse:
        """Get current daily usage and reset time"""
        count, reset_time, next_available = get_daily_limit_info(user_id)

        # next_available might be a string from Supabase RPC
        next_available_str = None
        if next_available:
            if isinstance(next_available, str):
                next_available_str = next_available
            else:
                next_available_str = next_available.isoformat()

        return DailyLimitResponse(
            used=count,
            limit=DAILY_REQUEST_LIMIT,
            remaining=max(0, DAILY_REQUEST_LIMIT - count),
            resets_at=reset_time.isoformat(),
            next_available_date=next_available_str,
        )

    @staticmethod
    async def process_action(
        token: str, action: str, feedback: str | None = None
    ) -> tuple[str, str]:
        """Process approve/reject action. Returns (new_status, html_response)"""
        if action not in ("approve", "reject"):
            raise HTTPException(400, "Invalid action")

        # Find request by token
        req = repository.get_by_token(token)
        if not req:
            raise HTTPException(404, "Invalid token")

        old_status = req["status"]
        new_status = "approved" if action == "approve" else "rejected"
        now = datetime.now(timezone.utc)

        # Update status
        repository.update(
            req["id"], {"status": new_status, "updated_at": now.isoformat()}
        )

        # Store feedback if provided
        if feedback:
            repository.add_feedback(
                request_id=req["id"],
                approver_email=req["approver_email"],
                feedback_text=feedback,
            )

        # Send notification to requester using stored email
        requester_email = req.get("requester_email")
        if requester_email:
            await email_service.send_status_notification(
                to_email=requester_email,
                request_title=req["title"] or "Untitled",
                old_status=old_status,
                new_status=new_status,
            )

        # Generate HTML response
        color = "#22c55e" if action == "approve" else "#ef4444"
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Thank You</title>
            <style>
                body {{ font-family: system-ui, sans-serif; 
                       display: flex; align-items: center; justify-content: center;
                       min-height: 100vh; margin: 0; background: #f5f5f5; }}
                .card {{ background: white; padding: 2rem; border-radius: 8px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }}
                .status {{ font-size: 2rem; font-weight: bold; color: {color}; margin: 1rem 0; }}
                p {{ color: #666; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Thank You!</h1>
                <div class="status">{new_status.title()}</div>
                <p>Your response has been recorded.</p>
            </div>
        </body>
        </html>
        """

        return new_status, html

    @staticmethod
    async def send_scheduled_internal(
        request_id: str, authorization: str | None = None
    ) -> dict:
        """Internal endpoint for Edge Function to send scheduled requests"""
        # Verify cron secret
        expected = f"Bearer {settings.CRON_SECRET or ''}"
        if authorization != expected:
            raise HTTPException(401, "Unauthorized")

        # Get request
        req = repository.get_by_id(request_id)
        if not req:
            raise HTTPException(404, "Request not found")

        if req["status"] != "scheduled":
            raise HTTPException(400, "Request is not scheduled")

        # Check daily limit
        count, reset_time, next_available = get_daily_limit_info(req["user_id"])

        if count >= DAILY_REQUEST_LIMIT:
            # Auto-reschedule for next available day
            if next_available:
                # Parse original scheduled time to keep the same time of day
                original_scheduled = datetime.fromisoformat(req["scheduled_send_at"])
                new_scheduled = datetime(
                    next_available.year
                    if isinstance(next_available, datetime)
                    else int(next_available.split("-")[0]),
                    next_available.month
                    if isinstance(next_available, datetime)
                    else int(next_available.split("-")[1]),
                    next_available.day
                    if isinstance(next_available, datetime)
                    else int(next_available.split("-")[2]),
                    original_scheduled.hour,
                    original_scheduled.minute,
                    original_scheduled.second,
                )

                repository.update(
                    request_id,
                    {
                        "scheduled_send_at": new_scheduled.isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    },
                )

                # Notify user of reschedule using stored email
                requester_email = req.get("requester_email")
                if requester_email:
                    await email_service.send_status_notification(
                        to_email=requester_email,
                        request_title=req["title"] or "Untitled",
                        old_status="scheduled",
                        new_status="scheduled",
                    )

            raise HTTPException(429, "Daily limit reached, auto-rescheduled")

        # Send email
        await send_approval_email(req)

        # Update status
        now = datetime.now(timezone.utc)
        deadline_days = req.get("deadline_days", 3)
        deadline = now + timedelta(days=deadline_days)
        repository.update(
            request_id,
            {
                "status": "pending",
                "sent_at": now.isoformat(),
                "deadline": deadline.isoformat(),
                "deadline_days": deadline_days,
                "follow_up_strategy": req.get(
                    "follow_up_strategy", {"enabled": True, "days_before_deadline": 1}
                ),
                "updated_at": now.isoformat(),
            },
        )

        # Send notification to requester using stored email
        requester_email = req.get("requester_email")
        if requester_email:
            await email_service.send_status_notification(
                to_email=requester_email,
                request_title=req["title"] or "Untitled",
                old_status="scheduled",
                new_status="pending",
            )

        return {"success": True}

    @staticmethod
    async def check_deadlines_and_send_followups(
        authorization: str | None = None,
    ) -> dict:
        """Check deadlines and send follow-ups or mark as ignored. Called by cron."""
        # Verify cron secret
        expected = f"Bearer {settings.CRON_SECRET or ''}"
        if authorization != expected:
            raise HTTPException(401, "Unauthorized")

        results = {"ignored": 0, "followups_sent": 0}

        # 1. Mark requests past deadline as ignored
        past_deadline = repository.get_requests_past_deadline()
        for req in past_deadline:
            repository.update(
                req["id"],
                {
                    "status": "ignored",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            results["ignored"] += 1
            logger.info(
                f"Request {req['id']} marked as ignored (deadline: {req['deadline']})"
            )

            # Notify requester
            requester_email = req.get("requester_email")
            if requester_email:
                try:
                    await email_service.send_ignored_notification(
                        to_email=requester_email,
                        request_title=req["title"] or "Untitled",
                        deadline=req["deadline"],
                    )
                except Exception as e:
                    logger.error(f"Failed to send ignored notification: {e}")

        # 2. Send any reminders that are now due (reminder model). The status
        #    flag on each row dedups; get_due_reminders only returns reminders
        #    whose parent request is still pending.
        for rem in repository.get_due_reminders():
            try:
                req = repository.get_by_id(rem["request_id"])
                if not req or req["status"] != "pending":
                    # Parent resolved/ignored since the row was queued; retire it.
                    repository.mark_reminder_sent(rem["reminder_id"])
                    continue
                await send_approval_email(req, is_followup=True, reminder=rem)
                repository.mark_reminder_sent(rem["reminder_id"])
                results["followups_sent"] += 1
                logger.info(
                    f"Sent {rem.get('kind')} reminder for request {rem['request_id']}"
                )
            except Exception as e:
                logger.error(
                    f"Failed to send reminder {rem.get('reminder_id')}: {e}"
                )

        return results

    @staticmethod
    async def send_reminder(
        reminder_id: str, authorization: str | None = None
    ) -> dict:
        """Send a single reminder by id. Called by the Edge Function per due row."""
        expected = f"Bearer {settings.CRON_SECRET or ''}"
        if authorization != expected:
            raise HTTPException(401, "Unauthorized")

        reminder = repository.get_reminder(reminder_id)
        if not reminder:
            raise HTTPException(404, "Reminder not found")
        if reminder["status"] != "pending":
            return {"skipped": "reminder not pending"}

        req = repository.get_by_id(reminder["request_id"])
        if not req or req["status"] != "pending":
            # Parent resolved/ignored; retire the reminder so it never re-fires.
            repository.mark_reminder_sent(reminder_id)
            return {"skipped": "parent not pending"}

        try:
            await send_approval_email(req, is_followup=True, reminder=reminder)
            repository.mark_reminder_sent(reminder_id)
            logger.info(
                f"Sent {reminder.get('kind')} reminder {reminder_id} "
                f"for request {reminder['request_id']}"
            )
            return {"success": True}
        except Exception as e:
            logger.error(f"Failed to send reminder {reminder_id}: {e}")
            raise HTTPException(500, str(e))


# Singleton instance
service = ApprovalRequestService()
