from datetime import datetime
from pydantic import BaseModel, EmailStr


class ApprovalRequestCreate(BaseModel):
    """Create request (immediate send or scheduled)"""

    approver_email: EmailStr
    title: str
    message: str | None = None
    file_url: str | None = None
    scheduled_send_at: str | None = None
    notify_requester: bool = True


class ApprovalRequestDraft(BaseModel):
    """Create draft (incomplete, not sent yet)"""

    approver_email: EmailStr | None = None
    title: str | None = None
    message: str | None = None
    file_url: str | None = None


class ApprovalRequestUpdate(BaseModel):
    """Update draft/scheduled (all fields optional)"""

    approver_email: EmailStr | None = None
    title: str | None = None
    message: str | None = None
    file_url: str | None = None
    scheduled_send_at: str | None = None
    notify_requester: bool | None = None


class ApprovalRequestResponse(BaseModel):
    id: str
    user_id: str
    requester_email: str | None  # Email of the person who created the request
    approver_email: str | None
    title: str | None
    message: str | None
    file_url: str | None
    token: str
    status: str
    scheduled_send_at: datetime | None
    sent_at: datetime | None
    created_at: datetime
    updated_at: datetime


class DailyLimitResponse(BaseModel):
    """Response for daily limit endpoint"""

    used: int
    limit: int
    remaining: int
    resets_at: str
    next_available_date: str | None
