"""
YesDrop API - Main application entry point.
Routes only - all business logic is in services.
"""

import logging
import httpx
import asyncio
import time
from datetime import datetime, timezone

from fastapi import FastAPI, Header, Depends, Query, Request, HTTPException
from fastapi.responses import HTMLResponse, Response
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from auth.user import get_current_user
from services.requests import service
from services.email import email_service
from services.database import repository
from services.gmail_service import gmail_service
from services.opencode_service import opencode_service
from models.schemas import (
    ApprovalRequestCreate,
    ApprovalRequestDraft,
    ApprovalRequestUpdate,
    ApprovalRequestResponse,
    DailyLimitResponse,
    ScheduleRequest,
    GoogleConnectRequest,
    GoogleStatusResponse,
    ReminderPlanRequest,
    ReminderPlanResponse,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="YesDrop API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Scheduling is driven entirely by Supabase cron edge functions
# (send-scheduled-requests + check-deadlines-followups, every 5 min UTC). The
# in-process APScheduler was removed to avoid a second, racing scheduler.


@app.post("/api/requests", response_model=ApprovalRequestResponse)
async def create_request(
    request: ApprovalRequestCreate,
    user_id: str = Depends(get_current_user),
):
    """Create request (immediate send or scheduled)"""
    return await service.create_request(request, user_id)


@app.post("/api/requests/draft", response_model=ApprovalRequestResponse)
async def create_draft(
    request: ApprovalRequestDraft,
    user_id: str = Depends(get_current_user),
):
    """Create a draft request (not sent, no daily limit check)"""
    return await service.create_draft(request, user_id)


@app.put("/api/requests/{request_id}/schedule", response_model=ApprovalRequestResponse)
async def schedule_request(
    request_id: str,
    data: ScheduleRequest,
    user_id: str = Depends(get_current_user),
):
    """Schedule a draft for sending"""
    try:
        logger.info(
            f"Schedule request: {request_id}, data: {data.dict()}, user_id: {user_id}"
        )
        result = await service.schedule_request(request_id, data.dict(), user_id)
        logger.info(f"Schedule successful for request {request_id}")
        return result
    except Exception as e:
        logger.error(f"Schedule request failed: {str(e)}", exc_info=True)
        raise


@app.post("/api/requests/{request_id}/send-now", response_model=ApprovalRequestResponse)
async def send_request_now(
    request_id: str,
    user_id: str = Depends(get_current_user),
):
    """Send a draft immediately"""
    return await service.send_request_now(request_id, user_id)


@app.put("/api/requests/{request_id}", response_model=ApprovalRequestResponse)
async def update_request(
    request_id: str,
    update_data: ApprovalRequestUpdate,
    user_id: str = Depends(get_current_user),
):
    """Update a draft or scheduled request"""
    return await service.update_request(request_id, update_data, user_id)


@app.delete("/api/requests/{request_id}")
async def delete_request(
    request_id: str,
    user_id: str = Depends(get_current_user),
):
    """Delete a draft or scheduled request"""
    return await service.delete_request(request_id, user_id)


@app.get("/api/requests", response_model=list[ApprovalRequestResponse])
async def list_requests(
    user_id: str = Depends(get_current_user),
    status: str | None = Query(None),
):
    """List user's requests with optional status filter"""
    return service.list_requests(user_id, status)


@app.get("/api/requests/limit", response_model=DailyLimitResponse)
async def get_daily_limit(
    user_id: str = Depends(get_current_user),
):
    """Get current daily usage and reset time"""
    return service.get_daily_limit(user_id)


@app.get("/api/google/status", response_model=GoogleStatusResponse)
async def google_status(user_id: str = Depends(get_current_user)):
    """Whether the user has connected a Gmail account for sending."""
    return gmail_service.get_status(user_id)


@app.post("/api/google/connect", response_model=GoogleStatusResponse)
async def google_connect(
    data: GoogleConnectRequest,
    user_id: str = Depends(get_current_user),
):
    """Store the one-time Google provider refresh token (captured after OAuth)."""
    gmail_service.store_tokens(
        user_id, data.refresh_token, email=data.email, scopes=data.scopes
    )
    return gmail_service.get_status(user_id)


@app.delete("/api/google/disconnect")
async def google_disconnect(user_id: str = Depends(get_current_user)):
    """Disconnect the user's Gmail sending account."""
    gmail_service.disconnect(user_id)
    return {"success": True}


@app.post("/api/reminders/generate", response_model=ReminderPlanResponse)
async def generate_reminder_plan(
    data: ReminderPlanRequest,
    user_id: str = Depends(get_current_user),
):
    """Generate a reminder schedule from a natural-language plan (opencode)."""
    return opencode_service.generate_reminder_plan(
        data.intent, data.sent_at, data.deadline
    )


# Short-lived in-process cache for the public stats endpoint so landing-page
# traffic does not hit Postgres on every request.
_PUBLIC_STATS_TTL = 300  # seconds
_public_stats_cache: dict = {"data": None, "at": 0.0}


@app.get("/api/stats")
async def public_stats():
    """Public global stats for the landing page (cached ~5 min)."""
    now = time.monotonic()
    if _public_stats_cache["data"] is None or (
        now - _public_stats_cache["at"] > _PUBLIC_STATS_TTL
    ):
        _public_stats_cache["data"] = repository.get_public_stats()
        _public_stats_cache["at"] = now
    return _public_stats_cache["data"]


@app.get("/api/stats/me")
async def my_stats(user_id: str = Depends(get_current_user)):
    """Per-user stats for the authenticated dashboard analytics band."""
    return repository.get_user_stats(user_id)


@app.get("/action")
async def action(token: str, action: str, feedback: str | None = Query(None)):
    """Handle approve/reject action (public endpoint)"""
    try:
        new_status, html = await service.process_action(token, action, feedback)
        return HTMLResponse(html)
    except HTTPException as e:
        if e.status_code == 400:
            return HTMLResponse(
                "<h1>Invalid action</h1><p>Use ?action=approve or ?action=reject</p>",
                status_code=400,
            )
        elif e.status_code == 404:
            return HTMLResponse("<h1>Invalid token</h1>", status_code=404)
        raise


@app.post("/api/internal/send-scheduled")
async def send_scheduled_request(
    data: dict,
    authorization: str | None = Header(None),
):
    """Internal endpoint for Edge Function to send scheduled requests"""
    return await service.send_scheduled_internal(data.get("request_id"), authorization)


@app.post("/api/internal/check-deadlines")
async def check_deadlines(
    authorization: str | None = Header(None),
):
    """Internal endpoint for cron to check deadlines and send follow-ups"""
    return await service.check_deadlines_and_send_followups(authorization)


@app.get("/track/open")
async def track_open(token: str, request: Request):
    """Track email open via pixel. Public endpoint, no auth required."""
    TRANSPARENT_GIF = b"\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x00\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b"

    try:
        req = repository.get_by_token(token)
        if req:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")
            repository.log_email_event(req["id"], ip_address, user_agent)
            logger.info(f"Logged email open for request {req['id']}")
    except Exception as e:
        logger.error(f"Error tracking email open: {e}")

    return Response(
        content=TRANSPARENT_GIF,
        media_type="image/gif",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/internal/notify-ignored")
async def notify_ignored(
    data: dict,
    authorization: str | None = Header(None),
):
    """Internal endpoint to send ignored notification"""
    expected = f"Bearer {settings.CRON_SECRET or ''}"
    if authorization != expected:
        raise HTTPException(401, "Unauthorized")

    try:
        await email_service.send_ignored_notification(
            to_email=data["requester_email"],
            request_title=data["request_title"] or "Untitled",
            deadline=data["deadline"],
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to send ignored notification: {e}")
        raise HTTPException(500, str(e))


@app.post("/api/internal/send-followup")
async def send_followup(
    data: dict,
    authorization: str | None = Header(None),
):
    """Internal endpoint: send a single due reminder by id (Edge Function calls per reminder)."""
    return await service.send_reminder(data.get("reminder_id"), authorization)
