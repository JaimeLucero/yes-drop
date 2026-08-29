"""E2E: create an approval request, send it through the real Gmail path, approve it.

Exercises the production code path (services.requests.send_approval_email with
SEND_PROVIDER=gmail), not a reimplementation. SENDS A REAL EMAIL.

Recipient defaults to the connected account itself (send-to-self) so no third
party is emailed.

    python scripts/gmail_e2e.py [approver_email]
"""
import sys
from pathlib import Path

# Run from anywhere: backend/ must be importable as the package root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import asyncio
import secrets
import sys
from datetime import datetime, timedelta, timezone

from core.config import settings
from services import requests as R
from services.database import supabase


def main() -> int:
    acct = (
        supabase.table("email_accounts")
        .select("*").eq("provider", "google").execute().data
    )
    if not acct:
        print("FAIL: no connected Google account")
        return 1
    acct = acct[0]
    user_id = acct["user_id"]
    sender = acct["email"]
    approver = sys.argv[1] if len(sys.argv) > 1 else sender

    print(f"SEND_PROVIDER = {settings.SEND_PROVIDER}")
    print(f"sender (Gmail): {sender}")
    print(f"approver       : {approver}")
    if settings.SEND_PROVIDER != "gmail":
        print("FAIL: SEND_PROVIDER is not 'gmail'; this would test the Brevo path")
        return 1

    # 1. Gate: refuses to send without a connected Gmail.
    R._require_gmail_connected(user_id)
    print("PASS  gate: _require_gmail_connected")

    # 2. Create a real pending request.
    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(32)
    row = {
        "user_id": user_id,
        "approver_email": approver,
        "title": "E2E check: Gmail OAuth send path",
        "message": "Automated end-to-end verification of the gmail.send path. Safe to ignore.",
        "token": token,
        "status": "pending",
        "sent_at": now.isoformat(),
        "deadline": (now + timedelta(days=3)).isoformat(),
        "requester_email": sender,
        "sender_email": sender,
    }
    created = supabase.table("approval_requests").insert(row).execute().data[0]
    rid = created["id"]
    print(f"PASS  created request {rid}")

    # 3. Send through the real path.
    try:
        asyncio.run(R.send_approval_email(created))
    except Exception as e:
        print(f"FAIL  send: {type(e).__name__}: {e}")
        supabase.table("approval_requests").delete().eq("id", rid).execute()
        return 1
    print("PASS  send_approval_email returned")

    # 4. Threading ids persisted (proves the Gmail branch ran, not Brevo).
    after = supabase.table("approval_requests").select("*").eq("id", rid).execute().data[0]
    mid, tid = after.get("gmail_message_id"), after.get("gmail_thread_id")
    print(f"      gmail_message_id: {mid}")
    print(f"      gmail_thread_id : {tid}")
    if not tid:
        print("FAIL  no gmail_thread_id persisted")
        return 1
    print("PASS  Gmail threading ids persisted")

    print()
    print("RESULT: PASS. Approval email sent from", sender, "to", approver)
    print("Approve link:")
    print(f"  {settings.FRONTEND_URL}/action?token={token}&action=approve")
    print(f"Request id {rid} left in place so you can click Approve and watch it flip.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
