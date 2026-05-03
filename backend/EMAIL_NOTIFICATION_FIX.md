# Email Notification Fix

## Problem

Email notifications for status changes (approved/rejected) were being sent to the user's UUID instead of their email address.

## Solution

Added `requester_email` field to store the email address of the person who created the request.

## Changes Made

### 1. Database Migration
```sql
-- Add requester_email column
ALTER TABLE public.approval_requests
ADD COLUMN IF NOT EXISTS requester_email TEXT;

-- Create function to fetch user email from Supabase Auth
CREATE OR REPLACE FUNCTION get_user_email(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  user_email TEXT;
BEGIN
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_uuid;
  
  RETURN user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Schema Update (`backend/models/schemas.py`)
Added `requester_email` field to `ApprovalRequestResponse`:
```python
class ApprovalRequestResponse(BaseModel):
    requester_email: str | None  # NEW FIELD
    # ... other fields
```

### 3. Service Updates (`backend/services/requests.py`)

**On Request Creation:**
- Fetch user's email from Supabase Auth using `get_user_email()`
- Store in `requester_email` field
- Use for status notifications

**On Status Change (Approve/Reject):**
- Use stored `requester_email` instead of `user_id`
- Send notification to correct email address

**All Notification Points Updated:**
- `create_request()` - when request is sent
- `schedule_request()` - when request is scheduled
- `send_request_now()` - when draft is sent
- `process_action()` - when approved/rejected
- `send_scheduled_internal()` - when auto-sent or rescheduled

### 4. Repository Update (`backend/services/database.py`)
Updated `to_response()` to include `requester_email` field.

## Email Flow Now

1. **User creates request** → Fetch email from Supabase Auth → Store in `requester_email`
2. **Approver clicks approve/reject** → Backend looks up `requester_email` → Sends notification to correct email
3. **User receives email** at their actual email address, not UUID

## Testing

✅ Backend imports successfully  
✅ Database migration applied  
✅ Schema updated  
✅ All notification points use `requester_email`

## Next Steps

1. Test with real Supabase user
2. Verify email notifications are received
3. Handle cases where user has no email (fallback to UUID)
