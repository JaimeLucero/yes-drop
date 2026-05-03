# Cron Jobs

## Backend: Reminder Endpoint

### API Route
```python
from fastapi import APIRouter, HTTPException, Header

router = APIRouter()

@router.post("/api/cron/reminders")
async def send_reminders(authorization: str = Header(None)):
    # Verify cron secret
    if authorization != f"Bearer {os.environ['CRON_SECRET']}":
        raise HTTPException(401, "Unauthorized")
    
    # Find pending requests older than 24 hours
    old_requests = await db.execute("""
        SELECT * FROM approval_requests 
        WHERE status = 'pending' 
        AND created_at < NOW() - INTERVAL '24 hours'
    """)
    
    for req in old_requests:
        await send_reminder_email(req)
    
    return {"sent": len(old_requests)}
```

### Render Cron Setup
1. Add Cron Job service on Render ($7/mo)
2. Schedule: every 30 minutes
3. URL: `https://your-backend.onrender.com/api/cron/reminders`
4. Headers:
   - Authorization: Bearer YOUR_CRON_SECRET

### What It Does
- Finds all pending requests > 24 hours old
- Re-sends approval email to approver
- Logs activity