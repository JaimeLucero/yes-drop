import secrets
import logging
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from auth.user import get_current_user
from services.email import email_service
from models.schemas import ApprovalRequestCreate, ApprovalRequestResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="YesDrop API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

requests_db: dict[str, dict] = {}


@app.post("/api/requests", response_model=ApprovalRequestResponse)
async def create_request(
    request: ApprovalRequestCreate,
    user_id: Annotated[str, Depends(get_current_user)],
):
    """Create approval request"""
    import uuid

    token = secrets.token_urlsafe(32)

    user_requests = [r for r in requests_db.values() if r["user_id"] == user_id]
    if len(user_requests) >= 5:
        raise HTTPException(400, "Free limit reached (5 requests)")

    req_id = str(uuid.uuid4())
    now = datetime.now()

    record = {
        "id": req_id,
        "user_id": user_id,
        "approver_email": request.approver_email,
        "title": request.title,
        "message": request.message,
        "file_url": request.file_url,
        "token": token,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
    }

    requests_db[req_id] = record

    approve_url = f"{settings.FRONTEND_URL}/action?token={token}&action=approve"
    reject_url = f"{settings.FRONTEND_URL}/action?token={token}&action=reject"

    html = f"""
    <html>
    <body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Approval Request</h2>
        <p><strong>{user_id[:8]}...</strong> is requesting your approval for:</p>
        <h3>{request.title}</h3>
        {f"<p>{request.message}</p>" if request.message else ""}
        {f'<p><a href="{request.file_url}">View attached file</a></p>' if request.file_url else ""}
        <div style="margin-top: 24px;">
            <a href="{approve_url}" style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 12px;">Approve</a>
            <a href="{reject_url}" style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Reject</a>
        </div>
    </body>
    </html>
    """

    await email_service.send_approval_request(
        to_email=request.approver_email,
        request_title=request.title,
        requester_email=user_id,
        html_content=html,
    )

    return record


@app.get("/api/requests", response_model=list[ApprovalRequestResponse])
async def list_requests(user_id: Annotated[str, Depends(get_current_user)]):
    """List user's requests"""
    user_requests = [r for r in requests_db.values() if r["user_id"] == user_id]
    user_requests.sort(key=lambda r: r["created_at"], reverse=True)
    return user_requests


@app.get("/action")
async def action(token: str, action: str):
    """Handle approve/reject action"""
    if action not in ("approve", "reject"):
        return HTMLResponse(
            "<h1>Invalid action</h1><p>Use ?action=approve or ?action=reject</p>",
            status_code=400,
        )

    req = None
    for r in requests_db.values():
        if r["token"] == token:
            req = r
            break

    if not req:
        return HTMLResponse("<h1>Invalid token</h1>", status_code=404)

    req["status"] = "approved" if action == "approve" else "rejected"
    req["updated_at"] = datetime.now()

    status = req["status"]
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
            <div class="status">{status.title()}</div>
            <p>Your response has been recorded.</p>
        </div>
    </body>
    </html>
    """)


@app.post("/api/cron/reminders")
async def send_reminders(authorization: str = Header(None)):
    """Send reminder emails for pending requests older than 24 hours"""
    expected = f"Bearer {settings.CRON_SECRET or ''}"
    if authorization != expected:
        raise HTTPException(401, "Unauthorized")

    now = datetime.now()
    reminder_count = 0

    for req in requests_db.values():
        if req["status"] == "pending":
            age = now - req["created_at"]
            if age > timedelta(hours=24):
                reminder_count += 1

    return {"sent": reminder_count}


@app.get("/health")
async def health():
    return {"status": "ok"}
