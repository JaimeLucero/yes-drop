from datetime import datetime
from pydantic import BaseModel, EmailStr
from typing import Optional


class FollowUpStrategy(BaseModel):
    """Flexible follow-up strategy configuration (legacy, kept for compat)"""

    enabled: bool = True
    days_before_deadline: Optional[int] = None
    days_after_sending: Optional[int] = None


class ReminderInput(BaseModel):
    """A single reminder at an absolute UTC time."""

    kind: str  # 'before_deadline' | 'after_sending' | 'absolute'
    send_at: str  # absolute UTC ISO timestamp
    custom_message: str | None = None


class ReminderPlanRequest(BaseModel):
    """Ask opencode to turn a natural-language intent into a reminder schedule."""

    intent: str
    sent_at: str | None = None  # ISO; when the request will be sent (default: now)
    deadline: str | None = None  # ISO; the response deadline, if already chosen


class ReminderPlanResponse(BaseModel):
    """A proposed (unsaved) schedule the user verifies, with absolute times."""

    deadline: str | None = None  # absolute ISO (may be derived from intent)
    reminders: list[ReminderInput] = []


class ApprovalRequestCreate(BaseModel):
    """Create request (immediate send or scheduled)"""

    approver_email: EmailStr
    title: str
    message: str | None = None
    file_url: str | None = None
    scheduled_send_at: str | None = None
    notify_requester: bool = True
    deadline_days: int = 3
    follow_up_strategy: FollowUpStrategy | None = None
    reminders: list[ReminderInput] | None = None
    # Optional verified sender identity (reply-to + CC). Must belong to the user.
    sender_email: EmailStr | None = None
    sender_name: str | None = None


class GoogleConnectRequest(BaseModel):
    """Capture the one-time Google provider refresh token after OAuth consent."""

    refresh_token: str
    email: str | None = None
    scopes: str | None = None


class GoogleStatusResponse(BaseModel):
    connected: bool = False
    email: str | None = None
    last_error: str | None = None


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
    deadline_days: int | None = None
    follow_up_strategy: FollowUpStrategy | None = None


class ScheduleRequest(BaseModel):
    """Schedule a draft request"""

    scheduled_send_at: str
    deadline_days: int | None = None
    follow_up_strategy: FollowUpStrategy | None = None
    reminders: list[ReminderInput] | None = None


class ApprovalRequestResponse(BaseModel):
    id: str
    user_id: str
    requester_email: str | None  # Email of the person who created the request
    sender_email: str | None = None  # Chosen sender identity (reply-to + CC)
    sender_name: str | None = None
    approver_email: str | None
    title: str | None
    message: str | None
    file_url: str | None
    feedback: str | None  # Feedback/comments from approver
    viewed_at: datetime | None = None  # Timestamp of first email open
    view_count: int = 0  # Total number of email opens
    token: str
    status: str
    scheduled_send_at: datetime | None
    sent_at: datetime | None
    deadline: datetime | None
    deadline_days: int | None
    follow_up_strategy: dict | None
    reminders: list[ReminderInput] = []
    created_at: datetime
    updated_at: datetime


class DailyLimitResponse(BaseModel):
    """Response for daily limit endpoint"""

    used: int
    limit: int
    remaining: int
    resets_at: str
    next_available_date: str | None
