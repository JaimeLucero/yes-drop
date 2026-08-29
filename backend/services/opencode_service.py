"""
Turn a natural-language follow-up intent into a reminder schedule via opencode.

opencode (OpenAI-compatible gateway) returns JSON of RELATIVE offsets; we
validate it and materialize absolute UTC send times from the request's send
time + deadline. The user always verifies/edits the result before it is saved.
"""

import json
import logging
import re
import time
from datetime import datetime, time as dtime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

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
    '"at": "<HH:MM, optional>", "custom_message": "<short, optional>"}]}\n'
    "Rules:\n"
    "- after_sending offsets are POSITIVE (time after the request is sent).\n"
    "- before_deadline offsets are NEGATIVE (time before the deadline).\n"
    "- deadline.offset is POSITIVE, relative to send time.\n"
    "- Set \"at\" ONLY when the user names a clock time (\"9 am\" -> \"09:00\", "
    '"5:30pm" -> "17:30"). It sets the time of day; the offset still picks the '
    "day. Omit it when no clock time was stated.\n"
    "- 1 to 5 reminders, ordered sensibly. custom_message is short and optional.\n"
    "NEVER INVENT DETAILS THE USER DID NOT GIVE:\n"
    '- No deadline stated? "deadline": null. Do not guess one.\n'
    "- No clock time stated? Omit \"at\". Do not guess one.\n"
    "- No message wording stated? Omit custom_message. Do not write one.\n"
    "- Only describe what the user actually asked for.\n"
    "Return JSON only."
)


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


_AT_RE = re.compile(r"^([01]?\d|2[0-3]):([0-5]\d)$")


def _resolve_tz(name: str | None) -> ZoneInfo | timezone:
    """The caller's zone, or UTC when absent/unrecognised."""
    if not name:
        return timezone.utc
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, KeyError):
        logger.warning(f"unknown timezone {name!r}; falling back to UTC")
        return timezone.utc


def _set_wall_clock(when: datetime, at: str, tz) -> datetime:
    """Pin `when` to the clock time `at` on its own local calendar day.

    The offset chooses the day; `at` chooses the time of day. Without this a
    "+1d" reminder inherits the send time-of-day, so "every 9 am" came out at
    whatever minute the request happened to be sent.
    """
    m = _AT_RE.match((at or "").strip())
    if not m:
        raise ValueError(f"invalid at: {at!r}")
    local = when.astimezone(tz)
    local = datetime.combine(
        local.date(), dtime(int(m.group(1)), int(m.group(2))), tzinfo=tz
    )
    return local.astimezone(timezone.utc)


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
        self,
        intent: str,
        sent_at: str | None = None,
        deadline: str | None = None,
        tz_name: str | None = None,
    ) -> ReminderPlanResponse:
        if not settings.OPENCODE_API_KEY or not settings.OPENCODE_MODEL:
            raise HTTPException(503, "Reminder AI is not configured")
        if not (intent or "").strip():
            raise HTTPException(400, "Describe your follow-up plan first")

        return self._call_opencode(intent, sent_at, deadline, tz_name)

    def _call_opencode(
        self,
        intent: str,
        sent_at: str | None,
        deadline: str | None,
        tz_name: str | None = None,
    ) -> ReminderPlanResponse:
        ctx = []
        if sent_at:
            ctx.append(f"The request is sent at {sent_at}.")
        if deadline:
            ctx.append(f"The response deadline is {deadline}.")
        user = (" ".join(ctx) + "\n\n" if ctx else "") + f"Plan: {intent}"

        # Primary first, then fallbacks. Skip a model already named as primary
        # so an env override can't make us try the same one twice.
        models = [settings.OPENCODE_MODEL] + [
            m for m in settings.OPENCODE_FALLBACK_MODELS if m != settings.OPENCODE_MODEL
        ]
        # Two passes: gateway failures are often transient (the same model
        # answers 503 then 200 seconds later), so a second lap is worth more
        # than giving up while the budget still allows another attempt.
        attempts = models * 2

        deadline_at = time.monotonic() + settings.OPENCODE_BUDGET_S
        last_error = "no models configured"
        for model in attempts:
            remaining = deadline_at - time.monotonic()
            if remaining <= 1:
                last_error = f"{last_error} (budget exhausted)"
                break
            try:
                resp = httpx.post(
                    f"{settings.OPENCODE_BASE_URL.rstrip('/')}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.OPENCODE_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "temperature": 0.2,
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": user},
                        ],
                    },
                    timeout=min(settings.OPENCODE_TIMEOUT_S, remaining),
                )
            except httpx.RequestError as e:
                # Timeout / connection failure. Worth trying the next model.
                last_error = f"{model}: {type(e).__name__}"
                logger.warning(f"opencode transport error on {model}: {e}")
                continue

            if resp.status_code == 200:
                # A 200 is not yet a usable schedule. Parse and materialize
                # here so a model that answers with prose, broken JSON, or an
                # empty reminder list falls through to the next candidate
                # instead of surfacing as a successful but empty plan.
                try:
                    content = resp.json()["choices"][0]["message"]["content"]
                    plan = self._extract_json(content)
                    result = self._materialize(plan, sent_at, deadline, tz_name)
                except (KeyError, IndexError, ValueError, HTTPException) as e:
                    last_error = f"{model}: unusable output ({type(e).__name__})"
                    logger.warning(f"opencode unusable output from {model}: {e}")
                    continue

                if not result.reminders:
                    last_error = f"{model}: returned no reminders"
                    logger.warning(f"opencode {model} returned an empty schedule")
                    continue

                if model != settings.OPENCODE_MODEL:
                    logger.warning(
                        f"opencode primary {settings.OPENCODE_MODEL} unavailable; "
                        f"served by fallback {model}"
                    )
                return result

            # Log the upstream body: raise_for_status() discards it, which
            # turns a precise provider message into an unexplained 400.
            body = resp.text[:500]
            last_error = f"{model}: HTTP {resp.status_code} {body}"

            # Auth and quota problems apply to every model on this key, so
            # retrying the list only wastes the user's time.
            if resp.status_code in (401, 403, 429):
                logger.error(f"opencode call failed, not retrying: {last_error}")
                break

            logger.warning(f"opencode {model} failed, trying next: {last_error}")

        logger.error(f"opencode: all models failed. Last error: {last_error}")
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
        self,
        plan: dict,
        sent_at: str | None,
        deadline: str | None,
        tz_name: str | None = None,
    ) -> ReminderPlanResponse:
        now = datetime.now(timezone.utc)
        tz = _resolve_tz(tz_name)
        base = _parse_dt(sent_at) or now
        deadline_abs = _parse_dt(deadline)

        # A deadline the user chose always wins. The model may only supply one
        # when the user left the field empty; otherwise a suggestion silently
        # overwrote an explicit choice, which read as the AI inventing a date.
        if deadline_abs is None:
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
                # The offset picked the day; a stated clock time now pins the
                # time of day in the requester's zone.
                at = r.get("at")
                if at:
                    when = _set_wall_clock(when, at, tz)
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
