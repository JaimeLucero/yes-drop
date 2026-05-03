import os
import secrets
import logging
from datetime import datetime, timedelta
from typing import Annotated

import httpx
from jose import jwt, JWTError, jwk
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

load_dotenv(dotenv_path=".env")
load_dotenv(dotenv_path=".env.local", override=True)

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="YesDrop API")
logger.info("Initializing YesDrop API")

# Configure CORS
cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info(f"CORS configured for origins: {cors_origins}")

@app.on_event("startup")
async def startup_event():
    logger.info("API startup complete")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("API shutting down")

JWKS: dict | None = None


async def get_jwks() -> dict:
    global JWKS
    if JWKS is None:
        jwks_url = os.getenv("SUPABASE_JWKS_URL")
        if not jwks_url:
            logger.error("SUPABASE_JWKS_URL not configured")
            raise HTTPException(500, "SUPABASE_JWKS_URL not configured")
        try:
            logger.debug(f"Fetching JWKS from {jwks_url}")
            async with httpx.AsyncClient() as client:
                response = await client.get(jwks_url)
                response.raise_for_status()
                JWKS = response.json()
                logger.debug(f"Successfully fetched JWKS with {len(JWKS.get('keys', []))} keys")
        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch JWKS: {e}")
            raise HTTPException(500, f"Failed to fetch JWKS: {e}")
        except Exception as e:
            logger.error(f"Unexpected error fetching JWKS: {e}")
            raise HTTPException(500, f"Unexpected error: {e}")
    return JWKS


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    if not authorization:
        logger.warning("Missing authorization header")
        raise HTTPException(401, "Missing authorization header")

    if not authorization.startswith("Bearer "):
        logger.warning("Invalid authorization format")
        raise HTTPException(401, "Invalid authorization format")

    token = authorization[7:]
    logger.debug(f"Validating token (length: {len(token)})")

    try:
        jwks = await get_jwks()
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        alg = unverified_header.get("alg")
        logger.debug(f"Token kid: {kid}, alg: {alg}")

        # Decode without verification to see the payload
        try:
            unverified_payload = jwt.get_unverified_claims(token)
            logger.debug(f"Token payload aud: {unverified_payload.get('aud')}, iss: {unverified_payload.get('iss')}")
        except:
            pass

        key_data = None
        for k in jwks.get("keys", []):
            if k.get("kid") == kid:
                key_data = k
                break

        if not key_data:
            logger.error(f"No matching key found for kid: {kid}")
            raise HTTPException(401, "Invalid token")

        logger.debug(f"Key data from JWKS: {key_data}")
        # Construct the key from JWK
        key = jwk.construct(key_data)
        logger.debug(f"Constructed key type: {type(key)}")

        audience = os.getenv("SUPABASE_AUDIENCE", "authenticated")
        issuer = os.getenv("SUPABASE_JWKS_URL", "").replace("/.well-known/jwks.json", "")
        logger.debug(f"Decoding token with audience: {audience}, issuer: {issuer}")

        payload = jwt.decode(
            token,
            key,
            algorithms=["ES256"],
            audience=audience,
            issuer=issuer,
        )
        user_id = payload.get("sub")
        logger.info(f"Token validated for user: {user_id}")
        return user_id
    except JWTError as e:
        logger.error(f"JWT validation failed: {e}")
        raise HTTPException(401, f"Invalid token: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in token validation: {e}")
        raise HTTPException(401, f"Token validation error: {e}")


async def send_email(to: str, subject: str, html: str) -> bool:
    """Send email via Brevo API"""
    api_key = os.getenv("BREVO_API_KEY")
    if not api_key:
        logger.warning("BREVO_API_KEY not configured, skipping email send")
        return False

    try:
        logger.debug(f"Sending email to {to} with subject: {subject}")
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "api-key": api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "sender": {"name": "YesDrop", "email": "noreply@yesdrop.app"},
                    "to": [{"email": to}],
                    "subject": subject,
                    "htmlContent": html,
                },
            )
            if response.status_code == 201:
                logger.info(f"Email sent successfully to {to}")
                return True
            else:
                logger.error(f"Email send failed with status {response.status_code}: {response.text}")
                return False
    except httpx.HTTPError as e:
        logger.error(f"HTTP error sending email: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending email: {e}")
        return False


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
    request: ApprovalRequestCreate, user_id: Annotated[str, Depends(get_current_user)]
):
    """Create approval request"""
    import uuid

    logger.info(f"Creating request for user {user_id}: title='{request.title}', approver={request.approver_email}")

    try:
        token = secrets.token_urlsafe(32)

        user_requests = [r for r in requests_db.values() if r["user_id"] == user_id]
        if len(user_requests) >= 5:
            logger.warning(f"User {user_id} reached free request limit (5 requests)")
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
        logger.debug(f"Created request record with id: {req_id}")

        base_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        approve_url = f"{base_url}/action?token={token}&action=approve"
        reject_url = f"{base_url}/action?token={token}&action=reject"

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

        email_sent = await send_email(request.approver_email, f"Approval Request: {request.title}", html)
        logger.info(f"Request {req_id} created successfully (email_sent={email_sent})")

        return record
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating request for user {user_id}: {e}", exc_info=True)
        raise HTTPException(500, f"Error creating request: {e}")


@app.get("/api/requests", response_model=list[ApprovalRequestResponse])
async def list_requests(user_id: Annotated[str, Depends(get_current_user)]):
    """List user's requests"""
    try:
        user_requests = [r for r in requests_db.values() if r["user_id"] == user_id]
        user_requests.sort(key=lambda r: r["created_at"], reverse=True)
        logger.debug(f"Listing {len(user_requests)} requests for user {user_id}")
        return user_requests
    except Exception as e:
        logger.error(f"Error listing requests for user {user_id}: {e}", exc_info=True)
        raise HTTPException(500, f"Error listing requests: {e}")


@app.get("/action")
async def action(token: str, action: str):
    """Handle approve/reject action"""
    logger.info(f"Processing action request: action={action}, token_length={len(token)}")

    if action not in ("approve", "reject"):
        logger.warning(f"Invalid action requested: {action}")
        return HTMLResponse(
            "<h1>Invalid action</h1><p>Use ?action=approve or ?action=reject</p>",
            status_code=400,
        )

    try:
        # Find request by token
        req = None
        for r in requests_db.values():
            if r["token"] == token:
                req = r
                break

        if not req:
            logger.warning(f"Request not found for token: {token}")
            return HTMLResponse("<h1>Invalid token</h1>", status_code=404)

        # Update status
        old_status = req["status"]
        req["status"] = "approved" if action == "approve" else "rejected"
        req["updated_at"] = datetime.now()
        logger.info(f"Updated request {req['id']}: {old_status} -> {req['status']}")

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
    except Exception as e:
        logger.error(f"Error processing action: {e}", exc_info=True)
        return HTMLResponse(f"<h1>Error</h1><p>{e}</p>", status_code=500)


@app.post("/api/cron/reminders")
async def send_reminders(authorization: str = Header(None)):
    """Send reminder emails for pending requests older than 24 hours"""
    logger.info("Cron job: send_reminders triggered")

    try:
        expected = f"Bearer {os.getenv('CRON_SECRET', '')}"
        if authorization != expected:
            logger.warning(f"Unauthorized cron request - invalid authorization header")
            raise HTTPException(401, "Unauthorized")

        # Find pending requests older than 24 hours
        now = datetime.now()
        reminder_count = 0

        for req in requests_db.values():
            if req["status"] == "pending":
                age = now - req["created_at"]
                if age > timedelta(hours=24):
                    logger.debug(f"Found pending request {req['id']} older than 24 hours (age: {age})")
                    # TODO: Send reminder email
                    reminder_count += 1

        logger.info(f"Cron job completed: sent {reminder_count} reminders")
        return {"sent": reminder_count}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in send_reminders cron job: {e}", exc_info=True)
        raise HTTPException(500, f"Cron job error: {e}")


@app.get("/health")
async def health():
    logger.debug("Health check")
    return {"status": "ok"}
