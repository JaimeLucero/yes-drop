import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated
import uuid

from fastapi import FastAPI, HTTPException, Header, Depends, Query
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client

from core.config import settings
from auth.user import get_current_user
from services.email import email_service
from models.schemas import (
    ApprovalRequestCreate,
    ApprovalRequestDraft,
    ApprovalRequestUpdate,
    ApprovalRequestResponse,
    DailyLimitResponse,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="YesDrop API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://yesdrop.online",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client
supabase: Client = create_client(
    settings.SUPABASE_URL or "", settings.SUPABASE_SERVICE_ROLE_KEY or ""
)


def to_response(record: dict) -> ApprovalRequestResponse:
    """Convert database record to response schema"""
    return ApprovalRequestResponse(
        id=record["id"],
        user_id=record["user_id"],
        approver_email=record.get("approver_email"),
        title=record.get("title"),
        message=record.get("message"),
        file_url=record.get("file_url"),
        token=record["token"],
        status=record["status"],
        scheduled_send_at=record.get("scheduled_send_at"),
        sent_at=record.get("sent_at"),
        created_at=record["created_at"],
        updated_at=record["updated_at"],
    )


async def send_approval_email(record: dict):
    """Send approval request email via Brevo"""
    approve_url = (
        f"{settings.FRONTEND_URL}/action?token={record['token']}&action=approve"
    )
    reject_url = f"{settings.FRONTEND_URL}/action?token={record['token']}&action=reject"

    html = f"""
    <html>
    <body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Approval Request</h2>
        <p><strong>{record["user_id"][:8]}...</strong> is requesting your approval for:</p>
        <h3>{record["title"]}</h3>
        {f"<p>{record["message"]}</p>" if record.get("message") else ""}
        {f'<p><a href="{record["file_url"]}">View attached file</a></p>' if record.get("file_url") else ""}
        <div style="margin-top: 24px;">
            <a href="{approve_url}" style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 12px;">Approve</a>
            <a href="{reject_url}" style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Reject</a>
        </div>
    </body>
    </html>
    """

    await email_service.send_approval_request(
        to_email=record["approver_email"],
        request_title=record["title"],
        requester_email=record["user_id"],
        html_content=html,
    )


def get_daily_limit_info(user_id: str) -> tuple[int, datetime, str | None]:
    """Get daily usage info using Supabase RPC function"""
    try:
        # Get daily count
        result = supabase.rpc("get_daily_sent_count", {"user_uuid": user_id}).execute()
        count = result.data if result.data else 0

        # Calculate reset time (midnight UTC)
        now_utc = datetime.now(timezone.utc)
        tomorrow_utc = (now_utc + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        # Get next available date
        next_date_result = supabase.rpc(
            "get_next_available_day", {"user_uuid": user_id}
        ).execute()
        next_available = next_date_result.data if next_date_result.data else None

        return count, tomorrow_utc, next_available
    except Exception as e:
        logger.error(f"Error getting daily limit: {e}")
        # Fallback to 0 if RPC fails
        now_utc = datetime.now(timezone.utc)
        tomorrow_utc = (now_utc + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        return 0, tomorrow_utc, None


@app.post("/api/requests", response_model=ApprovalRequestResponse)
async def create_request(
    request: ApprovalRequestCreate,
    user_id: Annotated[str, Depends(get_current_user)],
):
    """Create request (immediate send or scheduled)"""
    # Check daily limit only if sending immediately
    if not request.scheduled_send_at:
        count, reset_time, _ = get_daily_limit_info(user_id)
        if count >= 5:
            raise HTTPException(
                400,
                detail={
                    "message": "Daily limit reached (5 requests/day)",
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
        if scheduled_dt <= now:
            raise HTTPException(400, "scheduled_send_at must be in the future")
    else:
        status = "pending"
        scheduled_dt = None

    # Insert into database
    record = {
        "id": req_id,
        "user_id": user_id,
        "approver_email": request.approver_email,
        "title": request.title,
        "message": request.message,
        "file_url": request.file_url,
        "token": token,
        "status": status,
        "scheduled_send_at": scheduled_dt.isoformat() if scheduled_dt else None,
        "sent_at": now.isoformat() if status == "pending" else None,
        "notify_requester": request.notify_requester,
    }

    result = supabase.table("approval_requests").insert(record).execute()
    created = result.data[0]

    # Send email only if sending immediately
    if status == "pending":
        await send_approval_email(created)
        # Send notification to requester
        if request.notify_requester:
            await email_service.send_status_notification(
                to_email=user_id,  # This would need to be the user's email
                request_title=request.title,
                old_status="draft",
                new_status="pending",
            )

    return to_response(created)


@app.post("/api/requests/draft", response_model=ApprovalRequestResponse)
async def create_draft(
    request: ApprovalRequestDraft,
    user_id: Annotated[str, Depends(get_current_user)],
):
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

    result = supabase.table("approval_requests").insert(record).execute()
    return to_response(result.data[0])


@app.put("/api/requests/{request_id}/schedule", response_model=ApprovalRequestResponse)
async def schedule_request(
    request_id: str,
    data: dict,
    user_id: Annotated[str, Depends(get_current_user)],
):
    """Schedule a draft for sending"""
    # Get existing request
    result = (
        supabase.table("approval_requests").select("*").eq("id", request_id).execute()
    )
    if not result.data:
        raise HTTPException(404, "Request not found")

    req = result.data[0]
    if req["user_id"] != user_id:
        raise HTTPException(404, "Request not found")

    if req["status"] not in ("draft", "scheduled"):
        raise HTTPException(403, "Only drafts can be scheduled")

    # Parse scheduled time
    scheduled_dt = datetime.fromisoformat(
        data["scheduled_send_at"].replace("Z", "+00:00")
    )
    now = datetime.now(timezone.utc)
    if scheduled_dt <= now:
        raise HTTPException(400, "scheduled_send_at must be in the future")

    # Check if limit will be reached on that day (simplified check)
    scheduled_date = scheduled_dt.date()
    count_result = supabase.rpc(
        "get_daily_sent_count", {"user_uuid": user_id}
    ).execute()
    # Note: This checks current day, not the scheduled day
    # For production, would need to query by scheduled date

    # Update request
    update_data = {
        "status": "scheduled",
        "scheduled_send_at": scheduled_dt.isoformat(),
        "updated_at": now.isoformat(),
    }

    result = (
        supabase.table("approval_requests")
        .update(update_data)
        .eq("id", request_id)
        .execute()
    )
    updated = result.data[0]

    # Send notification
    await email_service.send_status_notification(
        to_email=req["user_id"],
        request_title=req["title"] or "Untitled",
        old_status="draft",
        new_status="scheduled",
        scheduled_time=scheduled_dt.strftime("%B %d, %Y at %I:%M %p UTC"),
    )

    return to_response(updated)


@app.post("/api/requests/{request_id}/send-now", response_model=ApprovalRequestResponse)
async def send_request_now(
    request_id: str,
    user_id: Annotated[str, Depends(get_current_user)],
):
    """Send a draft immediately"""
    # Get existing request
    result = (
        supabase.table("approval_requests").select("*").eq("id", request_id).execute()
    )
    if not result.data:
        raise HTTPException(404, "Request not found")

    req = result.data[0]
    if req["user_id"] != user_id:
        raise HTTPException(404, "Request not found")

    if req["status"] not in ("draft", "scheduled"):
        raise HTTPException(403, "Only drafts can be sent")

    # Check daily limit
    count, reset_time, _ = get_daily_limit_info(user_id)
    if count >= 5:
        raise HTTPException(
            400,
            detail={
                "message": "Daily limit reached (5 requests/day)",
                "resets_at": reset_time.isoformat(),
            },
        )

    # Update status and send email
    now = datetime.now(timezone.utc)
    update_data = {
        "status": "pending",
        "sent_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }

    result = (
        supabase.table("approval_requests")
        .update(update_data)
        .eq("id", request_id)
        .execute()
    )
    updated = result.data[0]

    await send_approval_email(updated)

    # Send notification to requester
    await email_service.send_status_notification(
        to_email=req["user_id"],
        request_title=req["title"] or "Untitled",
        old_status=req["status"],
        new_status="pending",
    )

    return to_response(updated)


@app.put("/api/requests/{request_id}", response_model=ApprovalRequestResponse)
async def update_request(
    request_id: str,
    update_data: ApprovalRequestUpdate,
    user_id: Annotated[str, Depends(get_current_user)],
):
    """Update a draft or scheduled request"""
    # Get existing request
    result = (
        supabase.table("approval_requests").select("*").eq("id", request_id).execute()
    )
    if not result.data:
        raise HTTPException(404, "Request not found")

    req = result.data[0]
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

    result = (
        supabase.table("approval_requests")
        .update(payload)
        .eq("id", request_id)
        .execute()
    )
    return to_response(result.data[0])


@app.delete("/api/requests/{request_id}")
async def delete_request(
    request_id: str,
    user_id: Annotated[str, Depends(get_current_user)],
):
    """Delete a draft or scheduled request"""
    # Get existing request
    result = (
        supabase.table("approval_requests").select("*").eq("id", request_id).execute()
    )
    if not result.data:
        raise HTTPException(404, "Request not found")

    req = result.data[0]
    if req["user_id"] != user_id:
        raise HTTPException(404, "Request not found")

    if req["status"] not in ("draft", "scheduled"):
        raise HTTPException(403, "Only drafts and scheduled requests can be deleted")

    supabase.table("approval_requests").delete().eq("id", request_id).execute()
    return {"message": "Request deleted successfully"}


@app.get("/api/requests", response_model=list[ApprovalRequestResponse])
async def list_requests(
    user_id: Annotated[str, Depends(get_current_user)],
    status: Annotated[str | None, Query()] = None,
):
    """List user's requests with optional status filter"""
    query = supabase.table("approval_requests").select("*").eq("user_id", user_id)

    if status:
        query = query.eq("status", status)

    query = query.order("created_at", desc=True)
    result = query.execute()

    return [to_response(r) for r in result.data]


@app.get("/api/requests/limit", response_model=DailyLimitResponse)
async def get_daily_limit(user_id: Annotated[str, Depends(get_current_user)]):
    """Get current daily usage and reset time"""
    count, reset_time, next_available = get_daily_limit_info(user_id)

    return DailyLimitResponse(
        used=count,
        limit=5,
        remaining=5 - count,
        resets_at=reset_time.isoformat(),
        next_available_date=next_available.isoformat() if next_available else None,
    )


@app.get("/action")
async def action(token: str, action: str):
    """Handle approve/reject action (public endpoint)"""
    if action not in ("approve", "reject"):
        return HTMLResponse(
            "<h1>Invalid action</h1><p>Use ?action=approve or ?action=reject</p>",
            status_code=400,
        )

    # Find request by token
    result = (
        supabase.table("approval_requests").select("*").eq("token", token).execute()
    )
    if not result.data:
        return HTMLResponse("<h1>Invalid token</h1>", status_code=404)

    req = result.data[0]
    old_status = req["status"]

    # Update status
    new_status = "approved" if action == "approve" else "rejected"
    now = datetime.now(timezone.utc)

    supabase.table("approval_requests").update(
        {
            "status": new_status,
            "updated_at": now.isoformat(),
        }
    ).eq("id", req["id"]).execute()

    # Send notification to requester
    await email_service.send_status_notification(
        to_email=req["user_id"],
        request_title=req["title"] or "Untitled",
        old_status=old_status,
        new_status=new_status,
    )

    # Return thank you page
    color = "#22c55e" if action == "approve" else "#ef4444"

    return HTMLResponse(f"""
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
    """)


@app.post("/api/internal/send-scheduled")
async def send_scheduled_request(
    data: dict,
    authorization: Annotated[str | None, Header()] = None,
):
    """Internal endpoint for Edge Function to send scheduled requests"""
    # Verify cron secret
    expected = f"Bearer {settings.CRON_SECRET or ''}"
    if authorization != expected:
        raise HTTPException(401, "Unauthorized")

    request_id = data.get("request_id")

    # Get request
    result = (
        supabase.table("approval_requests").select("*").eq("id", request_id).execute()
    )
    if not result.data:
        raise HTTPException(404, "Request not found")

    req = result.data[0]

    if req["status"] != "scheduled":
        raise HTTPException(400, "Request is not scheduled")

    # Check daily limit
    count, reset_time, next_available = get_daily_limit_info(req["user_id"])

    if count >= 5:
        # Auto-reschedule for next available day
        if next_available:
            # Parse original scheduled time to keep the same time of day
            original_scheduled = datetime.fromisoformat(req["scheduled_send_at"])
            new_scheduled = datetime(
                next_available.year,
                next_available.month,
                next_available.day,
                original_scheduled.hour,
                original_scheduled.minute,
                original_scheduled.second,
            )

            supabase.table("approval_requests").update(
                {
                    "scheduled_send_at": new_scheduled.isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", request_id).execute()

            # Notify user of reschedule
            await email_service.send_status_notification(
                to_email=req["user_id"],
                request_title=req["title"] or "Untitled",
                old_status="scheduled",
                new_status="scheduled",  # Still scheduled, just different time
            )

        raise HTTPException(429, "Daily limit reached, auto-rescheduled")

    # Send email
    await send_approval_email(req)

    # Update status
    now = datetime.now(timezone.utc)
    supabase.table("approval_requests").update(
        {
            "status": "pending",
            "sent_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
    ).eq("id", request_id).execute()

    # Send notification to requester
    await email_service.send_status_notification(
        to_email=req["user_id"],
        request_title=req["title"] or "Untitled",
        old_status="scheduled",
        new_status="pending",
    )

    return {"success": True}


@app.get("/health")
async def health():
    return {"status": "ok"}
