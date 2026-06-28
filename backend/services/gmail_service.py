"""
Per-user Gmail sending via OAuth (scope: gmail.send).

The user grants gmail.send during Google sign-in (or an explicit "Connect Gmail"
flow). We capture the one-time provider refresh token, encrypt it (Fernet) and
store it in `email_accounts`. Sending refreshes an access token on demand and
calls the Gmail API. Replies land in the user's own inbox (Reply-To = their
address); reading the mailbox for an in-app thread is out of scope (restricted
scope).
"""

import base64
import logging
from datetime import datetime, timezone
from email.message import EmailMessage

from cryptography.fernet import Fernet
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleAuthRequest
from googleapiclient.discovery import build

from core.config import settings
from services.database import supabase

logger = logging.getLogger(__name__)

GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"
TOKEN_URI = "https://oauth2.googleapis.com/token"


def _fernet() -> Fernet:
    if not settings.TOKEN_ENC_KEY:
        raise RuntimeError("TOKEN_ENC_KEY not configured")
    return Fernet(settings.TOKEN_ENC_KEY.encode())


class GmailService:
    """Store Google tokens and send mail as the user via the Gmail API."""

    def store_tokens(
        self,
        user_id: str,
        refresh_token: str,
        email: str | None = None,
        scopes: str | None = GMAIL_SEND_SCOPE,
    ) -> None:
        enc = _fernet().encrypt(refresh_token.encode()).decode()
        row = {
            "user_id": user_id,
            "provider": "google",
            "email": email,
            "refresh_token_encrypted": enc,
            "scopes": scopes,
            "last_error": None,
            "connected_at": datetime.now(timezone.utc).isoformat(),
        }
        supabase.table("email_accounts").upsert(
            row, on_conflict="user_id,provider"
        ).execute()
        logger.info(f"Stored Google tokens for user {user_id}")

    def _get_account(self, user_id: str) -> dict | None:
        result = (
            supabase.table("email_accounts")
            .select("*")
            .eq("user_id", user_id)
            .eq("provider", "google")
            .execute()
        )
        return result.data[0] if result.data else None

    def get_status(self, user_id: str) -> dict:
        acct = self._get_account(user_id)
        if not acct:
            return {"connected": False, "email": None, "last_error": None}
        return {
            "connected": True,
            "email": acct.get("email"),
            "last_error": acct.get("last_error"),
        }

    def disconnect(self, user_id: str) -> None:
        supabase.table("email_accounts").delete().eq("user_id", user_id).eq(
            "provider", "google"
        ).execute()

    def _set_error(self, user_id: str, message: str) -> None:
        try:
            supabase.table("email_accounts").update({"last_error": message}).eq(
                "user_id", user_id
            ).eq("provider", "google").execute()
        except Exception:
            pass

    def _credentials(self, user_id: str) -> tuple[Credentials, dict]:
        acct = self._get_account(user_id)
        if not acct:
            raise RuntimeError("No connected Google account")
        if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
            raise RuntimeError("GOOGLE_CLIENT_ID/SECRET not configured")
        refresh_token = _fernet().decrypt(acct["refresh_token_encrypted"].encode()).decode()
        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            token_uri=TOKEN_URI,
            scopes=[GMAIL_SEND_SCOPE],
        )
        creds.refresh(GoogleAuthRequest())
        return creds, acct

    def send(
        self,
        user_id: str,
        to_email: str,
        subject: str,
        html: str,
        rfc_message_id: str | None = None,
        in_reply_to: str | None = None,
        thread_id: str | None = None,
    ) -> tuple[str | None, str | None]:
        """Send an HTML email as the user. Returns (gmail_message_id, thread_id)."""
        try:
            creds, acct = self._credentials(user_id)
        except Exception as e:
            self._set_error(user_id, str(e))
            raise

        service = build("gmail", "v1", credentials=creds, cache_discovery=False)

        msg = EmailMessage()
        msg["To"] = to_email
        if acct.get("email"):
            msg["From"] = acct["email"]
        msg["Subject"] = subject
        if rfc_message_id:
            msg["Message-ID"] = rfc_message_id
        if in_reply_to:
            msg["In-Reply-To"] = in_reply_to
            msg["References"] = in_reply_to
        msg.set_content("This email requires an HTML-capable client.")
        msg.add_alternative(html, subtype="html")

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        body: dict = {"raw": raw}
        if thread_id:
            body["threadId"] = thread_id

        try:
            sent = service.users().messages().send(userId="me", body=body).execute()
        except Exception as e:
            self._set_error(user_id, str(e))
            logger.error(f"Gmail send failed for user {user_id}: {e}", exc_info=True)
            raise
        return sent.get("id"), sent.get("threadId")


gmail_service = GmailService()
