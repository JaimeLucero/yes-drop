"""
Turn a natural-language follow-up intent into a reminder schedule via opencode.

opencode (OpenAI-compatible gateway) returns JSON of RELATIVE offsets; we
validate it and materialize absolute UTC send times from the request's send
time + deadline. The user always verifies/edits the result before it is saved.
"""

import json
import logging
import re
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException

from core.config import settings
from models.schemas import ReminderInput, ReminderPlanResponse

logger = logging.getLogger(__name__)

_OFFSET_RE = re.compile(r"^([+-])(\d+)([dhm])$")
_UNIT = {"d": "days", "h": "hours", "m": "minutes"}

SYSTEM_PROMPT = (
    "You convert a natural-language follow-up plan into a strict JSON reminder "
    "schedule for an email approval request. Output ONLY a JSON object, no prose, "
    "with this exact shape:\n"
    '{"deadline": {"offset": "+<N><d|h>"} | null, "reminders": '
    '[{"kind": "before_deadline"|"after_sending", "offset": "<sign><N><d|h|m>", '
    '"custom_message": "<short, optional>"}]}\n'
    "Rules:\n"
    "- after_sending offsets are POSITIVE (time after the request is sent).\n"
    "- before_deadline offsets are NEGATIVE (time before the deadline).\n"
    "- deadline.offset is POSITIVE, relative to send time; use null if no deadline.\n"
    "- 1 to 5 reminders, ordered sensibly. custom_message is short and optional.\n"
    "Return JSON only."
)


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _apply_offset(base: datetime, offset: str) -> datetime:
    m = _OFFSET_RE.match((offset or "").strip())
    if not m:
        raise ValueError(f"invalid offset: {offset!r}")
    sign, num, unit = m.group(1), int(m.group(2)), m.group(3)
    delta = timedelta(**{_UNIT[unit]: num})
    return base + delta if sign == "+" else base - delta


class OpenCodeService:
    """Generate a reminder schedule from a natural-language intent."""

    def generate_reminder_plan(
        self, intent: str, sent_at: str | None = None, deadline: str | None = None
    ) -> ReminderPlanResponse:
        if not settings.OPENCODE_API_KEY or not settings.OPENCODE_MODEL:
            raise HTTPException(503, "Reminder AI is not configured")
        if not (intent or "").strip():
            raise HTTPException(400, "Describe your follow-up plan first")

        raw = self._call_opencode(intent, sent_at, deadline)
        plan = self._extract_json(raw)
        return self._materialize(plan, sent_at, deadline)

    def _call_opencode(
        self, intent: str, sent_at: str | None, deadline: str | None
    ) -> str:
        ctx = []
        if sent_at:
            ctx.append(f"The request is sent at {sent_at}.")
        if deadline:
            ctx.append(f"The response deadline is {deadline}.")
        user = (" ".join(ctx) + "\n\n" if ctx else "") + f"Plan: {intent}"

        try:
            resp = httpx.post(
                f"{settings.OPENCODE_BASE_URL.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENCODE_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.OPENCODE_MODEL,
                    "temperature": 0.2,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user},
                    ],
                },
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"opencode call failed: {e}", exc_info=True)
            raise HTTPException(502, "Could not generate a schedule. Try again.")

    @staticmethod
    def _extract_json(raw: str) -> dict:
        text = (raw or "").strip()
        # Strip code fences and grab the first {...} block.
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise HTTPException(502, "AI returned an unreadable schedule")
        try:
            obj = json.loads(match.group(0))
        except json.JSONDecodeError:
            raise HTTPException(502, "AI returned invalid JSON")
        if not isinstance(obj, dict):
            raise HTTPException(502, "AI returned an unexpected schedule")
        return obj

    def _materialize(
        self, plan: dict, sent_at: str | None, deadline: str | None
    ) -> ReminderPlanResponse:
        now = datetime.now(timezone.utc)
        base = _parse_dt(sent_at) or now
        deadline_abs = _parse_dt(deadline)

        plan_deadline = plan.get("deadline")
        if isinstance(plan_deadline, dict) and plan_deadline.get("offset"):
            try:
                deadline_abs = _apply_offset(base, plan_deadline["offset"])
            except ValueError:
                pass

        reminders: list[ReminderInput] = []
        for r in plan.get("reminders", []) or []:
            if not isinstance(r, dict):
                continue
            kind = r.get("kind")
            if kind not in ("before_deadline", "after_sending"):
                continue
            try:
                if kind == "before_deadline":
                    if not deadline_abs:
                        continue
                    when = _apply_offset(deadline_abs, r.get("offset", ""))
                else:
                    when = _apply_offset(base, r.get("offset", ""))
            except ValueError:
                continue
            if when <= now:
                continue
            if deadline_abs and when >= deadline_abs:
                continue
            reminders.append(
                ReminderInput(
                    kind=kind,
                    send_at=when.isoformat(),
                    custom_message=(r.get("custom_message") or None),
                )
            )

        reminders.sort(key=lambda x: x.send_at)
        return ReminderPlanResponse(
            deadline=deadline_abs.isoformat() if deadline_abs else deadline,
            reminders=reminders,
        )


opencode_service = OpenCodeService()
