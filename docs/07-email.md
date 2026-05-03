# Email Flow

## Backend: Brevo API

### Setup
1. Sign up for Brevo (free tier)
2. Get API key from Brevo dashboard
3. Install: `pip install brevo-python`

### Send Email
```python
from brevo_python import TransactionalEmailsApi
from brevo_python.model import SendSmtpEmail, SendSmtpEmailSender

api = TransactionalEmailsApi(api_client)

email = SendSmtpEmail(
    sender=SendSmtpEmailSender(email="noreply@yesdrop.app", name="YesDrop"),
    to=[{"email": approver_email}],
    subject=f"[YesDrop] Action needed: {title}",
    html_content=f"""
    <p>{requester_name} is asking for your approval on:</p>
    <h2>{title}</h2>
    <p>{message}</p>
    <a href="{approve_url}" style="background:green;color:white;padding:12px 24px;text-decoration:none;">Approve</a>
    <a href="{reject_url}" style="background:red;color:white;padding:12px 24px;text-decoration:none;">Reject</a>
    """
)
api.send_transac_email(email)
```

### Magic Links
- Approve: `https://your-backend.com/action?token={token}&action=approve`
- Reject: `https://your-backend.com/action?token={token}&action=reject`

### Environment Variables
```
BREVO_API_KEY=xxx
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com
```