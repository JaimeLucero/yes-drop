from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from typing import Literal, Optional

MAX_COMPOSE_PROMPT_LENGTH = 1000
MODEL_ID_PATTERN = r"^[A-Za-z0-9._:-]{1,100}$"
MIN_API_KEY_LENGTH = 8
MAX_API_KEY_LENGTH = 512


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


class ComposeRequest(BaseModel):
    """Turn a natural-language prompt into a full approval automation."""

    prompt: str = Field(max_length=MAX_COMPOSE_PROMPT_LENGTH)
    now: str | None = Field(default=None, max_length=64)  # client ISO; origin for relative scheduling (default: server now)


class AiSettingsRequest(BaseModel):
    """Bring-your-own-key AI provider settings."""

    provider: Literal["gemini", "anthropic", "openai"]
    model: str = Field(pattern=MODEL_ID_PATTERN)
    api_key: str = Field(min_length=MIN_API_KEY_LENGTH, max_length=MAX_API_KEY_LENGTH)


class AiSettingsResponse(BaseModel):
    configured: bool = False
    provider: str | None = None
    model: str | None = None


class ComposeResponse(BaseModel):
    """A proposed (unsaved) automation the user reviews before sending.

    Maps onto the new-request form: content fields plus an absolute schedule.
    """

    approver_email: str | None = None  # empty if the prompt named no address
    title: str
    message: str | None = None
    deadline: str | None = None  # absolute UTC ISO
    scheduled_send_at: str | None = None  # absolute UTC ISO, or null = send now
    reminders: list[ReminderInput] = []  # absolute UTC send_at, bounded by deadline


class ApprovalRequestCreate(BaseModel):
    """Create request (immediate send or scheduled)"""

    approver_email: EmailStr
    title: str
    message: str | None = None
    file_url: str | None = None
    scheduled_send_at: str | None = None
    notify_requester: bool = True
    deadline_days: int = Field(3, ge=1, le=365)
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
    deadline_days: int | None = Field(None, ge=1, le=365)
    follow_up_strategy: FollowUpStrategy | None = None


class ScheduleRequest(BaseModel):
    """Schedule a draft request"""

    scheduled_send_at: str
    deadline_days: int | None = Field(None, ge=1, le=365)
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
    status: str
    scheduled_send_at: datetime | None
    sent_at: datetime | None
    deadline: datetime | None
    deadline_days: int | None
    follow_up_strategy: dict | None
    reminders: list[ReminderInput] = []
    response_file_url: str | None = None  # Receiver's signed/edited copy
    response_signed_at: datetime | None = None
    signer_name: str | None = None
    created_at: datetime
    updated_at: datetime


class PublicRequest(BaseModel):
    """Request context exposed to the unauthenticated action page (by token).

    Everything here already appears in the approval email the holder of this
    token received, so surfacing it costs no additional disclosure. Internal
    fields (user_id, token, reminder schedule) stay out.
    """

    title: str | None = None
    message: str | None = None
    file_url: str | None = None
    status: str
    requester: str | None = None
    deadline: str | None = None
    sent_at: str | None = None


class DailyLimitResponse(BaseModel):
    """Response for daily limit endpoint"""

    used: int
    limit: int
    remaining: int
    resets_at: str
    next_available_date: str | None
