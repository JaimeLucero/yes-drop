import os
import secrets
from datetime import datetime, timedelta

from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr

load_dotenv()

app = FastAPI(title="YesDrop API")


# Pydantic schemas
class ApprovalRequestCreate(BaseModel):
    approver_email: EmailStr
    title: str
    message: str | None = None
    file_url: str | None = None


class ApprovalRequestResponse(BaseModel):
    id: str
    user_id: str
    approver_email: str
    title: str
    message: str | None
    file_url: str | None
    token: str
    status: str
    created_at: datetime
    updated_at: datetime


# In-memory storage for demo (replace with PostgreSQL in production)
requests_db: dict[str, dict] = {}


@app.post("/api/requests", response_model=ApprovalRequestResponse)
async def create_request(
    request: ApprovalRequestCreate, authorization: str = Header(None)
):
    """Create approval request"""
    # TODO: Validate JWT and get user_id from Supabase
    # For now, use a placeholder user_id
    import uuid

    user_id = str(uuid.uuid4())

    # Generate unique token
    token = secrets.token_urlsafe(32)

    # Check rate limit (5 requests per user)
    user_requests = [r for r in requests_db.values() if r["user_id"] == user_id]
    if len(user_requests) >= 5:
        raise HTTPException(400, "Free limit reached (5 requests)")

    # Create record
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

    # TODO: Send email via Brevo

    return record


@app.get("/api/requests", response_model=list[ApprovalRequestResponse])
async def list_requests(authorization: str = Header(None)):
    """List user's requests"""
    # TODO: Validate JWT and get user_id
    # For now, return all requests
    return list(requests_db.values())


@app.get("/action")
async def action(token: str, action: str):
    """Handle approve/reject action"""
    if action not in ("approve", "reject"):
        return HTMLResponse(
            "<h1>Invalid action</h1><p>Use ?action=approve or ?action=reject</p>",
            status_code=400,
        )

    # Find request by token
    req = None
    for r in requests_db.values():
        if r["token"] == token:
            req = r
            break

    if not req:
        return HTMLResponse("<h1>Invalid token</h1>", status_code=404)

    # Update status
    req["status"] = "approved" if action == "approve" else "rejected"
    req["updated_at"] = datetime.now()

    # Return thank you page
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
    expected = f"Bearer {os.getenv('CRON_SECRET', '')}"
    if authorization != expected:
        raise HTTPException(401, "Unauthorized")

    # Find pending requests older than 24 hours
    now = datetime.now()
    reminder_count = 0

    for req in requests_db.values():
        if req["status"] == "pending":
            age = now - req["created_at"]
            if age > timedelta(hours=24):
                # TODO: Send reminder email
                reminder_count += 1

    return {"sent": reminder_count}


@app.get("/health")
async def health():
    return {"status": "ok"}
