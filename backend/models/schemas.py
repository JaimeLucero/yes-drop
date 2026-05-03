from datetime import datetime
from pydantic import BaseModel, EmailStr


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
