"""
YesDrop API - Main application entry point.
Routes only - all business logic is in services.
"""

import logging
import httpx
import asyncio
import time
from datetime import datetime, timezone

from fastapi import FastAPI, Header, Depends, Query, Request, HTTPException, UploadFile, File, Form
from fastapi.responses import HTMLResponse, Response
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from auth.user import get_current_user
from services.requests import service
from services.email import email_service
from services.database import repository
from services.gmail_service import gmail_service
from services.compose_service import compose_service
from services.ai_provider_keys import ai_provider_key_store
from services.ai_providers import list_models
from services.ai_rate_limit import enforce_ai_rate_limit
from models.schemas import (
    AiModelsRequest,
    AiModelsResponse,
    AiSettingsRequest,
    AiSettingsResponse,
    ApprovalRequestCreate,
    ApprovalRequestDraft,
    ApprovalRequestUpdate,
    ApprovalRequestResponse,
    ComposeRequest,
    ComposeResponse,
    ScheduleRequest,
    GoogleConnectRequest,
    GoogleStatusResponse,
    PublicRequest,
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
    """Create a draft request (not sent)"""
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


@app.get("/api/ai/settings", response_model=AiSettingsResponse)
async def get_ai_settings(user_id: str = Depends(get_current_user)):
    """Which AI provider the user connected. Never returns the key itself."""
    return ai_provider_key_store.get_status(user_id)


@app.put("/api/ai/settings", response_model=AiSettingsResponse)
async def save_ai_settings(
    data: AiSettingsRequest,
    user_id: str = Depends(get_current_user),
):
    """Store the user's own AI provider key, encrypted, once the provider accepts it."""
    await asyncio.to_thread(list_models, data.provider, data.api_key)
    ai_provider_key_store.save(user_id, data.provider, data.model, data.api_key)
    return ai_provider_key_store.get_status(user_id)


@app.post("/api/ai/models", response_model=AiModelsResponse)
async def list_ai_models(
    data: AiModelsRequest,
    user_id: str = Depends(get_current_user),
):
    """Verify a key with its provider and return the recent models it can use."""
    model_ids = await asyncio.to_thread(list_models, data.provider, data.api_key)
    return {"models": model_ids}


@app.delete("/api/ai/settings")
async def delete_ai_settings(user_id: str = Depends(get_current_user)):
    """Remove the user's stored AI provider key."""
    ai_provider_key_store.delete(user_id)
    return {"success": True}


@app.post("/api/compose", response_model=ComposeResponse)
async def compose_automation(
    data: ComposeRequest,
    user_id: str = Depends(get_current_user),
):
    """Compose a full approval automation from a prompt using the user's own AI key.
    The result prefills the form for review; nothing is sent."""
    credentials = ai_provider_key_store.get_credentials(user_id)
    if not credentials:
        raise HTTPException(400, "Add your AI provider key in Settings to use AI compose.")
    enforce_ai_rate_limit(user_id)
    repository.record_ai_usage(user_id, "compose")
    # Blocking httpx call to the provider; keep it off the event loop.
    return await asyncio.to_thread(compose_service.compose, credentials, data.prompt, data.now)


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


@app.get("/api/public/requests/{token}", response_model=PublicRequest)
async def public_request(token: str):
    """Minimal request info for the unauthenticated action page (by token)."""
    return service.get_public_request(token)


@app.post("/action/response-document")
async def upload_response_document(
    token: str = Query(...),
    file: UploadFile = File(...),
    signer_name: str | None = Query(None),
):
    """Receiver uploads a signed/edited copy of the attached document (public, token)."""
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10MB)")
    return service.store_response_document(
        token, content, file.content_type or "application/pdf", signer_name
    )


def _action_error_response(e: HTTPException):
    """Map action-flow HTTPExceptions to friendly HTML pages."""
    if e.status_code == 400:
        return HTMLResponse(
            "<h1>Invalid action</h1><p>Use ?action=approve or ?action=reject</p>",
            status_code=400,
        )
    if e.status_code == 404:
        return HTMLResponse("<h1>Invalid token</h1>", status_code=404)
    raise e


@app.get("/action")
async def action(token: str, action: str):
    """Render the approve/reject confirmation interstitial (public endpoint).

    A decision is only recorded via the POST from this page; passive email
    link-scanners that GET the URL can't complete the action.
    """
    try:
        return HTMLResponse(service.render_confirm_page(token, action))
    except HTTPException as e:
        return _action_error_response(e)


@app.post("/action/confirm")
async def action_confirm(
    token: str = Form(...),
    action: str = Form(...),
    feedback: str | None = Form(None),
):
    """Record the approve/reject decision submitted from the confirmation page."""
    try:
        _, html = await service.process_action(token, action, feedback)
        return HTMLResponse(html)
    except HTTPException as e:
        return _action_error_response(e)


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
