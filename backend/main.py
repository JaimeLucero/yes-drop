"""
YesDrop API - Main application entry point.
Routes only - all business logic is in services.
"""

import logging

from fastapi import FastAPI, Header, Depends, Query
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from auth.user import get_current_user
from services.requests import service
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
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://yesdrop.online",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
        logger.info(f"Schedule request: {request_id}, data: {data.dict()}, user_id: {user_id}")
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


@app.get("/health")
async def health():
    return {"status": "ok"}
