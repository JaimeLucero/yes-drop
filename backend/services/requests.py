"""
Business logic for approval requests.
"""

import asyncio
import html as html_lib
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import HTTPException

from services.database import repository, to_response, supabase
from services.email import email_service
from services.gmail_service import gmail_service
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


def _require_gmail_connected(user_id: str) -> None:
    """Hard-gate (gmail mode only): a request can only be sent if Gmail is connected."""
    if settings.SEND_PROVIDER != "gmail":
        return
    if not gmail_service.get_status(user_id).get("connected"):
        raise HTTPException(
            400,
            detail={
                "message": "Connect Gmail to send approval requests.",
                "code": "gmail_not_connected",
            },
        )


async def send_approval_email(
    record: dict, is_followup: bool = False, reminder: dict | None = None
):
    """Send approval request email via Brevo.

    When ``is_followup`` is set, ``reminder`` (a request_reminders row or the
    get_due_reminders projection) drives the subject prefix and urgency banner,
    which are computed dynamically from the live time window, with no hardcoded
    day values, so any reminder schedule renders correct copy.
    """
    approve_url = (
        f"{settings.FRONTEND_URL}/action?token={record['token']}&action=approve"
    )
    reject_url = f"{settings.FRONTEND_URL}/action?token={record['token']}&action=reject"

    requester_display = (
        record.get("sender_name")
        or record.get("sender_email")
        or record.get("requester_email")
        or record["user_id"][:8]
    )
    # Mail clients auto-linkify a bare address and restyle it with their own
    # link color, which reads as blue-on-navy in the header. Supplying our own
    # anchor keeps the client from injecting one.
    requester_link = (
        f'<a href="mailto:{requester_display}" style="color: #ffffff; text-decoration: none;">{requester_display}</a>'
        if "@" in str(requester_display)
        else f'<span style="color: #ffffff;">{requester_display}</span>'
    )
    # A reminder may override the body copy with its own custom message.
    body_text = (reminder or {}).get("custom_message") or record.get("message")
    message_section = (
        f'<p style="color: #666; font-size: 15px; line-height: 1.6; margin: 16px 0;">{body_text}</p>'
        if body_text
        else ""
    )
    file_section = (
        f'<p style="margin: 16px 0;"><a href="{record["file_url"]}" style="color: #33436a; text-decoration: none; font-weight: 500;">📎 View attached file</a></p>'
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
        <div style="background: #33436a; padding: 24px 0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 0 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td style="vertical-align: middle;"><img src="{settings.EMAIL_ASSET_BASE_URL}/yesdrop-icon.png" width="32" height="32" alt="YesDrop" style="display: block; border-radius: 8px; border: 0; outline: none; text-decoration: none;" /></td>
                    <td style="vertical-align: middle; padding-left: 10px;"><span style="color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.01em;">YesDrop</span></td>
                </tr></table>
                <p style="color: rgba(255,255,255,0.75); margin: 10px 0 0 0; font-size: 14px;">Approval request from {requester_link}</p>
            </div>
        </div>

        <div style="max-width: 600px; margin: 0 auto; padding: 40px 24px;">
            {urgency_banner}
            <div style="background: #f9fafb; border-left: 4px solid #33436a; padding: 20px; border-radius: 4px; margin-bottom: 32px;">
                <h2 style="color: #1f2937; margin: 0 0 8px 0; font-size: 20px; font-weight: 600;">{record["title"]}</h2>
                <p style="color: #6b7280; margin: 0; font-size: 13px;">Needs your approval</p>
            </div>

            {message_section}
            {file_section}

            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin: 32px 0;">
                <p style="color: #6b7280; font-size: 13px; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">What do you want to do?</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 16px;"><tr>
                    <td style="padding-right: 6px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                            <td align="center" bgcolor="#16a34a" style="border-radius: 6px;">
                                <a href="{approve_url}" style="display: block; padding: 13px 24px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">&#10003; Approve</a>
                            </td>
                        </tr></table>
                    </td>
                    <td style="padding-left: 6px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                            <td align="center" bgcolor="#dc2626" style="border-radius: 6px;">
                                <a href="{reject_url}" style="display: block; padding: 13px 24px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">&#10007; Reject</a>
                            </td>
                        </tr></table>
                    </td>
                </tr></table>
                <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">Or reply to this email to provide feedback</p>
            </div>

            <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
                    Please respond by <strong>{deadline_str}</strong> or this request will be marked as ignored.<br/>
                    <a href="{settings.FRONTEND_URL}/dashboard" style="color: #33436a; text-decoration: none; font-weight: 500;">View all requests on YesDrop</a>
                </p>
            </div>
        </div>

        <div style="background: #f3f4f6; padding: 24px 0; text-align: center; border-top: 1px solid #e5e7eb; margin-top: 32px;">
            <p style="color: #6b7280; font-size: 12px; margin: 0; max-width: 600px; margin-left: auto; margin-right: auto; padding: 0 24px;">
                YesDrop makes approval requests simple and seamless.<br/>
                <a href="https://yesdrop.online" style="color: #33436a; text-decoration: none;">Learn more</a>
            </p>
        </div>

        {tracking_pixel}
    </body>
    </html>
    """

    if settings.SEND_PROVIDER == "gmail":
        # Send through the requester's own Gmail. Replies thread in their inbox.
        rfc_message_id = (
            record.get("gmail_message_id") or f"<approval-{record['id']}@yesdrop.online>"
        )
        # Gmail send + token refresh are blocking network calls; run them off the
        # event loop so one slow send can't stall the whole worker.
        _, thread_id = await asyncio.to_thread(
            gmail_service.send,
            user_id=record["user_id"],
            to_email=record["approver_email"],
            subject=f"{subject_prefix}Approval Request: {record['title']}",
            html=html,
            rfc_message_id=rfc_message_id,
            in_reply_to=record.get("gmail_message_id") if is_followup else None,
            thread_id=record.get("gmail_thread_id"),
        )
        # Persist threading ids from the first send so follow-ups stay in-thread.
        if not is_followup and (
            not record.get("gmail_message_id") or not record.get("gmail_thread_id")
        ):
            repository.update(
                record["id"],
                {"gmail_message_id": rfc_message_id, "gmail_thread_id": thread_id},
            )
    else:
        # Brevo (default): send from the verified YesDrop domain. A chosen sender
        # identity (already ownership-validated by the caller) sets reply-to and
        # is CC'd so the thread also lands in the sender's inbox.
        sender_email = record.get("sender_email")
        await email_service.send_approval_request(
            to_email=record["approver_email"],
            request_title=record["title"],
            requester_email=record.get("requester_email") or "noreply@em.yesdrop.online",
            html_content=html,
            subject_prefix=subject_prefix,
            sender_name=record.get("sender_name"),
            sender_email=sender_email,
            cc=[sender_email] if sender_email else None,
        )


def _page(inner_html: str) -> str:
    """Wrap card content in the shared minimal action-page shell."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>YesDrop</title>
        <style>
            body {{ font-family: system-ui, sans-serif;
                   display: flex; align-items: center; justify-content: center;
                   min-height: 100vh; margin: 0; background: #f5f5f5; }}
            .card {{ background: white; padding: 2rem; border-radius: 8px; max-width: 440px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }}
            .status {{ font-size: 2rem; font-weight: bold; margin: 1rem 0; }}
            p {{ color: #666; }}
            textarea {{ width: 100%; box-sizing: border-box; min-height: 90px; margin: 12px 0;
                       padding: 10px; border: 1px solid #ddd; border-radius: 6px; font: inherit; }}
            button {{ border: none; border-radius: 6px; padding: 12px 24px; font-size: 15px;
                     font-weight: 600; color: white; cursor: pointer; }}
        </style>
    </head>
    <body><div class="card">{inner_html}</div></body>
    </html>
    """


def _result_page(status: str, already: bool = False) -> str:
    """Final outcome page after a decision is recorded (or was already made)."""
    color = "#22c55e" if status == "approved" else "#ef4444"
    note = (
        f"This request was already {status}."
        if already
        else "Your response has been recorded."
    )
    return _page(
        f'<h1>Thank You!</h1>'
        f'<div class="status" style="color: {color};">{status.title()}</div>'
        f"<p>{note}</p>"
    )


def _not_actionable_page(status: str) -> str:
    """Shown when the link targets a request that can't be decided (draft/scheduled/ignored)."""
    return _page(
        '<h1>Not available</h1>'
        f"<p>This request is <strong>{html_lib.escape(status)}</strong> and can no longer "
        "be actioned from this link.</p>"
    )


def _confirm_page(token: str, action: str, title: str) -> str:
    """Interstitial: a POST form so passive link-prefetchers can't auto-decide.

    Email security scanners issue GET requests to every link; rendering a confirm
    button that POSTs the decision means only a real click completes the action.
    """
    verb = "Approve" if action == "approve" else "Reject"
    color = "#22c55e" if action == "approve" else "#ef4444"
    safe_token = html_lib.escape(token, quote=True)
    safe_action = html_lib.escape(action, quote=True)
    return _page(
        f'<h1>{verb} request?</h1>'
        f'<p>You are about to <strong>{verb.lower()}</strong> "{html_lib.escape(title)}".</p>'
        f'<form method="POST" action="/action/confirm">'
        f'<input type="hidden" name="token" value="{safe_token}">'
        f'<input type="hidden" name="action" value="{safe_action}">'
        '<textarea name="feedback" placeholder="Optional message to the requester..."></textarea>'
        f'<button type="submit" style="background: {color};">Confirm {verb}</button>'
        '</form>'
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

        # Validate the optional sender identity: only honor an address that
        # actually belongs to this user (their auth email), else ignore it, because an
        # unverified reply-to/CC would let a user spoof a third party.
        # NOTE: not persisted (no sender_email column yet), so this reply-to/CC
        # applies to immediate Brevo sends only; scheduled/reminder sends would
        # need a schema column + UI to carry it.
        sender_email = None
        sender_name = None
        if request.sender_email and requester_email and (
            request.sender_email.lower() == requester_email.lower()
        ):
            sender_email = request.sender_email
            sender_name = request.sender_name

        # Check daily limit only if sending immediately
        if not request.scheduled_send_at:
            _require_gmail_connected(user_id)
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
            try:
                scheduled_dt = datetime.fromisoformat(
                    request.scheduled_send_at.replace("Z", "+00:00")
                )
            except (ValueError, AttributeError):
                raise HTTPException(400, "Invalid scheduled_send_at format")
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
            # Augment the in-memory record with the validated sender identity so
            # the Brevo reply-to/CC path can use it (the DB row has no such column).
            email_record = {
                **created,
                "sender_email": sender_email,
                "sender_name": sender_name,
            }
            try:
                await send_approval_email(email_record)
            except Exception as e:
                logger.error(
                    f"Failed to send approval email for request {req_id}: {e}",
                    exc_info=True,
                )
                # Never leave a non-sent request looking 'Sent'. Revert to a
                # draft so the user sees it didn't go out and can retry.
                repository.update(req_id, {"status": "draft", "sent_at": None})
                raise HTTPException(
                    502,
                    detail={
                        "message": "We couldn't send the email. Reconnect your Gmail in Settings, then try again. Your request was saved as a draft.",
                        "code": "send_failed",
                    },
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

        _require_gmail_connected(user_id)

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
        # `or 3`, not get(..., 3): a NULL column returns None and timedelta(days=None) crashes.
        deadline_days = req.get("deadline_days") or 3
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
            # Roll back to its prior status so a failed send isn't shown as 'Sent'.
            repository.update(
                request_id, {"status": req["status"], "sent_at": req.get("sent_at")}
            )
            raise HTTPException(
                502,
                detail={
                    "message": "We couldn't send the email. Reconnect your Gmail in Settings, then try again.",
                    "code": "send_failed",
                },
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
            try:
                scheduled_dt = datetime.fromisoformat(
                    update_data.scheduled_send_at.replace("Z", "+00:00")
                )
            except (ValueError, AttributeError):
                raise HTTPException(400, "Invalid scheduled_send_at format")
            if scheduled_dt.tzinfo is None:
                scheduled_dt = scheduled_dt.replace(tzinfo=timezone.utc)
            if scheduled_dt <= datetime.now(timezone.utc):
                raise HTTPException(400, "scheduled_send_at must be in the future")
            payload["scheduled_send_at"] = scheduled_dt.isoformat()

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
    def get_public_request(token: str) -> dict:
        """Minimal request info for the unauthenticated action page."""
        req = repository.get_by_token(token)
        if not req:
            raise HTTPException(404, "Invalid token")
        return {
            "title": req.get("title"),
            "message": req.get("message"),
            "file_url": req.get("file_url"),
            "status": req["status"],
            # Same display precedence as the email header, so the action page
            # names the requester exactly as the email did.
            "requester": (
                req.get("sender_name")
                or req.get("sender_email")
                or req.get("requester_email")
            ),
            "deadline": req.get("deadline"),
            "sent_at": req.get("sent_at"),
        }

    @staticmethod
    def store_response_document(
        token: str,
        file_bytes: bytes,
        content_type: str = "application/pdf",
        signer_name: str | None = None,
    ) -> dict:
        """Store the receiver's signed/edited copy against a pending request."""
        req = repository.get_by_token(token)
        if not req:
            raise HTTPException(404, "Invalid token")
        if req["status"] != "pending":
            raise HTTPException(400, "This request is no longer open")
        url = repository.upload_response_file(file_bytes, content_type)
        repository.update(
            req["id"],
            {
                "response_file_url": url,
                "response_signed_at": datetime.now(timezone.utc).isoformat(),
                "signer_name": signer_name,
            },
        )
        return {"response_file_url": url}

    @staticmethod
    def render_confirm_page(token: str, action: str) -> str:
        """Render the GET-side interstitial (or the outcome, if already decided)."""
        if action not in ("approve", "reject"):
            raise HTTPException(400, "Invalid action")
        req = repository.get_by_token(token)
        if not req:
            raise HTTPException(404, "Invalid token")

        status = req["status"]
        if status in ("approved", "rejected"):
            return _result_page(status, already=True)
        if status != "pending":
            return _not_actionable_page(status)
        return _confirm_page(token, action, req.get("title") or "this request")

    @staticmethod
    async def process_action(
        token: str, action: str, feedback: str | None = None
    ) -> tuple[str, str]:
        """Record an approve/reject decision. Returns (final_status, html_response).

        Idempotent and guarded: only a still-`pending` request can be decided,
        and the transition is claimed atomically so a prefetch or double-submit
        can't re-decide, duplicate feedback, or re-notify.
        """
        if action not in ("approve", "reject"):
            raise HTTPException(400, "Invalid action")

        # Find request by token
        req = repository.get_by_token(token)
        if not req:
            raise HTTPException(404, "Invalid token")

        old_status = req["status"]
        if old_status in ("approved", "rejected"):
            # Already decided: show the recorded outcome, don't mutate or re-notify.
            return old_status, _result_page(old_status, already=True)
        if old_status != "pending":
            # draft / scheduled / ignored are not actionable from the email link.
            return old_status, _not_actionable_page(old_status)

        new_status = "approved" if action == "approve" else "rejected"
        now = datetime.now(timezone.utc)

        # Atomically claim the decision (pending -> approved/rejected).
        decided = repository.claim_decision(req["id"], new_status, now.isoformat())
        if not decided:
            # Lost the race to a concurrent decision; surface the winning outcome.
            latest = repository.get_by_token(token)
            final = latest["status"] if latest else new_status
            return final, _result_page(final, already=True)

        # Stop any pending follow-up reminders now that a decision was made.
        repository.cancel_pending_reminders(req["id"])

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
                response_file_url=req.get("response_file_url"),
            )

        return new_status, _result_page(new_status, already=False)

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

        # In gmail mode, Gmail must be connected. Leave scheduled so it sends once connected.
        if settings.SEND_PROVIDER == "gmail" and not gmail_service.get_status(
            req["user_id"]
        ).get("connected"):
            logger.warning(
                f"Scheduled request {request_id} not sent: Gmail not connected"
            )
            return {"success": False, "reason": "gmail_not_connected"}

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

        # Atomically claim the send: flip scheduled -> pending BEFORE sending so
        # two overlapping cron invocations can't both send this request.
        now = datetime.now(timezone.utc)
        # `or 3`, not get(..., 3): a NULL column returns None and timedelta(days=None) crashes.
        deadline_days = req.get("deadline_days") or 3
        deadline = now + timedelta(days=deadline_days)
        claimed = repository.claim_scheduled_send(
            request_id,
            {
                "status": "pending",
                "sent_at": now.isoformat(),
                "deadline": deadline.isoformat(),
                "deadline_days": deadline_days,
                "follow_up_strategy": req.get(
                    "follow_up_strategy", {"enabled": True, "days_before_deadline": 1}
                ),
            },
        )
        if not claimed:
            # Another cron invocation already claimed and sent this request.
            return {"success": False, "reason": "already_sent"}

        try:
            await send_approval_email(claimed)
        except Exception:
            # Roll the claim back so the next cron retries instead of losing the send.
            repository.update(
                request_id,
                {"status": "scheduled", "sent_at": None, "deadline": None},
            )
            raise

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
                # Claim pending -> sent before sending so overlapping cron runs
                # can't double-send this reminder.
                if not repository.claim_reminder(rem["reminder_id"]):
                    continue
                try:
                    await send_approval_email(req, is_followup=True, reminder=rem)
                except Exception:
                    # Revert the claim so the next cron retries.
                    repository.reset_reminder_pending(rem["reminder_id"])
                    raise
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

        # Claim pending -> sent before sending so a concurrent invocation can't
        # double-send this reminder.
        if not repository.claim_reminder(reminder_id):
            return {"skipped": "already sent"}

        try:
            await send_approval_email(req, is_followup=True, reminder=reminder)
            logger.info(
                f"Sent {reminder.get('kind')} reminder {reminder_id} "
                f"for request {reminder['request_id']}"
            )
            return {"success": True}
        except Exception as e:
            # Revert the claim so the next cron retries.
            repository.reset_reminder_pending(reminder_id)
            logger.error(f"Failed to send reminder {reminder_id}: {e}")
            raise HTTPException(500, str(e))


# Singleton instance
service = ApprovalRequestService()
