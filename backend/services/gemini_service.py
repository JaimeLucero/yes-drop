"""
Turn a natural-language prompt into a full approval-email automation via Gemini.

Gemini returns a strict JSON object of email content plus RELATIVE schedule
offsets; we materialize absolute UTC send/deadline/reminder times server-side
(reusing the opencode offset helpers). The user always reviews/edits the result
in the form before anything is sent; this endpoint never sends email.
"""

import json
import logging
import re
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException

from core.config import settings
from models.schemas import ComposeResponse, ReminderInput
from services.opencode_service import _apply_offset, _parse_dt

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are an assistant that turns a short request into an email approval "
    "automation for the app YesDrop. The user describes who must approve what, "
    "by when, and how to follow up. Output ONLY a JSON object with this shape:\n"
    '{"title": "<short subject>", "message": "<2-4 sentence professional body '
    'addressed to the approver>", "approver_email": "<email or empty string>", '
    '"deadline_offset": "+<N><d|h>", "scheduled_offset": "" | "+<N><d|h>", '
    '"reminders": [{"kind": "before_deadline"|"after_sending", '
    '"offset": "<sign><N><d|h|m>", "custom_message": "<short, optional>"}]}\n'
    "Rules:\n"
    "- title: concise, no 'Approval Request:' prefix (the app adds one).\n"
    "- message: polite, specific, ready to send; do not invent facts.\n"
    "- approver_email: copy the address if the prompt gives one, else empty string.\n"
    "- deadline_offset is POSITIVE relative to send time (default +3d if unstated).\n"
    "- scheduled_offset: empty string to send now, else POSITIVE relative to now.\n"
    "- after_sending offsets are POSITIVE; before_deadline offsets are NEGATIVE.\n"
    "- 0 to 5 reminders, ordered sensibly. Return JSON only."
)

# Gemini structured-output schema (OpenAPI subset). Forces clean JSON.
_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "message": {"type": "string"},
        "approver_email": {"type": "string"},
        "deadline_offset": {"type": "string"},
        "scheduled_offset": {"type": "string"},
        "reminders": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "kind": {
                        "type": "string",
                        "enum": ["before_deadline", "after_sending"],
                    },
                    "offset": {"type": "string"},
                    "custom_message": {"type": "string"},
                },
                "required": ["kind", "offset"],
            },
        },
    },
    "required": ["title", "message"],
}


class GeminiService:
    """Compose a full approval automation from a natural-language prompt."""

    def compose(self, prompt: str, now: str | None = None) -> ComposeResponse:
        if not settings.GEMINI_API_KEY:
            raise HTTPException(503, "AI compose is not configured")
        if not (prompt or "").strip():
            raise HTTPException(400, "Describe the approval you want to send first")

        raw = self._call_gemini(prompt)
        plan = self._extract_json(raw)
        return self._materialize(plan, now)

    def _call_gemini(self, prompt: str) -> str:
        url = (
            f"{settings.GEMINI_BASE_URL.rstrip('/')}"
            f"/models/{settings.GEMINI_MODEL}:generateContent"
        )
        try:
            resp = httpx.post(
                url,
                params={"key": settings.GEMINI_API_KEY},
                headers={"Content-Type": "application/json"},
                json={
                    "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
                    "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.3,
                        "responseMimeType": "application/json",
                        "responseSchema": _RESPONSE_SCHEMA,
                    },
                },
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except httpx.HTTPStatusError as e:
            if e.response is not None and e.response.status_code == 429:
                logger.warning("Gemini quota exhausted (429)")
                raise HTTPException(
                    429,
                    detail={
                        "message": "AI is busy right now. Try again shortly, or fill the form in manually.",
                        "scope": "provider",
                    },
                )
            logger.error(f"Gemini call failed: {e}", exc_info=True)
            raise HTTPException(502, "Could not compose the automation. Try again.")
        except Exception as e:
            logger.error(f"Gemini call failed: {e}", exc_info=True)
            raise HTTPException(502, "Could not compose the automation. Try again.")

    @staticmethod
    def _extract_json(raw: str) -> dict:
        text = (raw or "").strip()
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise HTTPException(502, "AI returned an unreadable draft")
        try:
            obj = json.loads(match.group(0))
        except json.JSONDecodeError:
            raise HTTPException(502, "AI returned invalid JSON")
        if not isinstance(obj, dict):
            raise HTTPException(502, "AI returned an unexpected draft")
        return obj

    def _materialize(self, plan: dict, now: str | None) -> ComposeResponse:
        now_dt = datetime.now(timezone.utc)
        base = _parse_dt(now) or now_dt

        # Scheduled send: only honored if strictly in the future; else send now.
        scheduled_send_at: str | None = None
        send_origin = base
        sched_offset = (plan.get("scheduled_offset") or "").strip()
        if sched_offset:
            try:
                sched = _apply_offset(base, sched_offset)
                if sched > now_dt:
                    scheduled_send_at = sched.isoformat()
                    send_origin = sched
            except ValueError:
                pass

        # Deadline relative to the send time; default +3d; never in the past.
        try:
            deadline_abs = _apply_offset(send_origin, plan.get("deadline_offset") or "+3d")
        except ValueError:
            deadline_abs = send_origin + timedelta(days=3)
        if deadline_abs <= now_dt:
            deadline_abs = send_origin + timedelta(days=3)

        reminders: list[ReminderInput] = []
        for r in plan.get("reminders", []) or []:
            if not isinstance(r, dict):
                continue
            kind = r.get("kind")
            if kind not in ("before_deadline", "after_sending"):
                continue
            try:
                if kind == "before_deadline":
                    when = _apply_offset(deadline_abs, r.get("offset", ""))
                else:
                    when = _apply_offset(send_origin, r.get("offset", ""))
            except ValueError:
                continue
            if when <= now_dt or when >= deadline_abs:
                continue
            reminders.append(
                ReminderInput(
                    kind=kind,
                    send_at=when.isoformat(),
                    custom_message=(r.get("custom_message") or None),
                )
            )
        reminders.sort(key=lambda x: x.send_at)

        email = (plan.get("approver_email") or "").strip()
        title = (plan.get("title") or "").strip()
        if not title:
            raise HTTPException(502, "AI did not return a title")

        return ComposeResponse(
            approver_email=email or None,
            title=title,
            message=(plan.get("message") or "").strip() or None,
            deadline=deadline_abs.isoformat(),
            scheduled_send_at=scheduled_send_at,
            reminders=reminders,
        )


gemini_service = GeminiService()
