# Database Schema

## Table: approval_requests

```sql
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  approver_email TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  file_url TEXT,
  token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ar_user_id ON approval_requests(user_id);
CREATE INDEX idx_ar_token ON approval_requests(token);
CREATE INDEX idx_ar_status ON approval_requests(status);
```

## SQLAlchemy Model

```python
from sqlalchemy import Column, String, DateTime, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class ApprovalRequest(Base):
    __tablename__ = "approval_requests"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    approver_email = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(String)
    file_url = Column(String)
    token = Column(String, unique=True, nullable=False)
    status = Column(String, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'approved', 'rejected')"),
    )
```

## Environment Variables

```
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/yesdrop
```