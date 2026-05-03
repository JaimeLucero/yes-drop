"""
YesDrop API - Main application entry point.
Routes only - all business logic is in services.
"""

import logging
import httpx
import asyncio
from datetime import datetime, timezone

from fastapi import FastAPI, Header, Depends, Query, Request
from fastapi.responses import HTMLResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from core.config import settings
from auth.user import get_current_user
from services.requests import service
from services.database import repository
from models.schemas import (
    ApprovalRequestCreate,
    ApprovalRequestDraft,
    ApprovalRequestUpdate,
    ApprovalRequestResponse,
    DailyLimitResponse,
    ScheduleRequest,
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


# Background scheduler for checking scheduled requests
def check_and_send_scheduled():
    """Check for scheduled requests and call Edge Function only if there are any"""
    try:
        # Check if there are any scheduled requests due
        scheduled_requests = repository.get_scheduled_due()

        if not scheduled_requests:
            logger.debug("No scheduled requests due at this time")
            return

        logger.info(
            f"Found {len(scheduled_requests)} scheduled request(s) to send. Triggering Edge Function..."
        )

        # Only call Edge Function if there are requests to send
        if settings.CRON_SECRET and settings.SUPABASE_URL:
            try:
                response = httpx.post(
                    f"{settings.SUPABASE_URL}/functions/v1/send-scheduled-requests",
                    headers={"Authorization": f"Bearer {settings.CRON_SECRET}"},
                    timeout=30.0,
                )
                if response.status_code == 200:
                    logger.info(
                        f"Edge Function executed successfully: {response.json()}"
                    )
                else:
                    logger.error(
                        f"Edge Function returned status {response.status_code}: {response.text}"
                    )
            except Exception as e:
                logger.error(f"Error calling Edge Function: {e}")
        else:
            logger.warning(
                "CRON_SECRET or SUPABASE_URL not configured, cannot trigger Edge Function"
            )
    except Exception as e:
        logger.error(f"Error in scheduled request check: {e}", exc_info=True)


def check_deadlines_and_followups():
    """Check deadlines and send follow-ups"""
    try:
        logger.info("Running deadline and follow-up check...")
        asyncio.run(service.check_deadlines_and_send_followups())
        logger.info("Deadline and follow-up check complete")
    except Exception as e:
        logger.error(f"Error in deadline check: {e}", exc_info=True)


scheduler = None


def start_scheduler():
    """Start background scheduler"""
    global scheduler
    try:
        scheduler = BackgroundScheduler()
        scheduler.add_job(
            check_and_send_scheduled,
            "interval",
            minutes=5,
            id="check_scheduled_requests",
        )
        scheduler.add_job(
            check_deadlines_and_followups,
            "interval",
            hours=1,
            id="check_deadlines_followups",
        )
        scheduler.start()
        logger.info("✓ Scheduled request checker started (runs every 5 minutes)")
        logger.info("✓ Deadline and follow-up checker started (runs every hour)")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}", exc_info=True)


@app.on_event("startup")
def startup_event():
    """Start background tasks on app startup"""
    logger.info("Starting application...")
    start_scheduler()
    logger.info("✓ Application startup complete")


@app.on_event("shutdown")
def shutdown_event():
    """Shutdown background tasks"""
    global scheduler
    if scheduler:
        try:
            scheduler.shutdown()
            logger.info("✓ Scheduler shutdown complete")
        except Exception as e:
            logger.error(f"Error during scheduler shutdown: {e}")


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
    """Internal endpoint to send follow-up emails"""
    expected = f"Bearer {settings.CRON_SECRET or ''}"
    if authorization != expected:
        raise HTTPException(401, "Unauthorized")

    request_id = data.get("request_id")
    followup_type = data.get("followup_type")

    req = repository.get_by_id(request_id)
    if not req:
        raise HTTPException(404, "Request not found")

    try:
        # Send follow-up email
        await send_approval_email(req, is_followup=True, followup_type=followup_type)

        # Record the follow-up event
        event_type = f"followup_{followup_type}"
        repository.add_email_event(request_id, event_type)

        logger.info(f"Sent {followup_type} follow-up for request {request_id}")
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to send follow-up: {e}")
        raise HTTPException(500, str(e))
