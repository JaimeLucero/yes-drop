"""
Turn a natural-language prompt into a full approval-email automation using the
AI provider and API key the user configured.

The provider returns a JSON object of email content plus RELATIVE schedule
offsets; we materialize absolute UTC send/deadline/reminder times server-side.
The user always reviews/edits the result in the form before anything is sent;
this endpoint never sends email.
"""

import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from models.schemas import ComposeResponse, ReminderInput
from services.ai_provider_keys import AiProviderCredentials
from services.ai_providers import request_json_text

_OFFSET_RE = re.compile(r"^([+-])(\d+)([dhm])$")
_UNIT = {"d": "days", "h": "hours", "m": "minutes"}
MAX_CLIENT_CLOCK_SKEW = timedelta(days=1)


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
    try:
        delta = timedelta(**{_UNIT[unit]: num})
        return base + delta if sign == "+" else base - delta
    except OverflowError:
        raise ValueError(f"offset out of range: {offset!r}")


def _parse_client_now(client_now: str | None) -> None:
    """Reject an unparseable or implausible client clock before it seeds scheduling."""
    if not client_now:
        return
    try:
        parsed_now = _parse_dt(client_now)
    except ValueError:
        raise HTTPException(400, "Invalid current time")
    clock_skew = abs(parsed_now - datetime.now(timezone.utc))
    if clock_skew > MAX_CLIENT_CLOCK_SKEW:
        raise HTTPException(400, "Your device clock looks wrong. Fix it and try again.")


_CONTACT_DETAIL_PATTERNS = (
    ("EMAIL", re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")),
    ("URL", re.compile(r"(?:https?://|www\.)[^\s)]+")),
    ("PHONE", re.compile(r"\+?\d[\d\s().-]{7,}\d")),
)


@dataclass(frozen=True)
class RedactedPrompt:
    text: str
    original_by_placeholder: dict[str, str]


def redact_contact_details(prompt: str) -> RedactedPrompt:
    """Replace emails, URLs and phone numbers with placeholders so none reach the AI provider."""
    original_by_placeholder: dict[str, str] = {}
    redacted_text = prompt
    for label, pattern in _CONTACT_DETAIL_PATTERNS:
        def replace_with_placeholder(match: re.Match) -> str:
            placeholder = f"[{label}_{len(original_by_placeholder) + 1}]"
            original_by_placeholder[placeholder] = match.group(0)
            return placeholder

        redacted_text = pattern.sub(replace_with_placeholder, redacted_text)
    return RedactedPrompt(redacted_text, original_by_placeholder)


def restore_contact_details(text: str, original_by_placeholder: dict[str, str]) -> str:
    for placeholder, original in original_by_placeholder.items():
        text = text.replace(placeholder, original)
    return text


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
    "- approver_email: copy a placeholder such as [EMAIL_1] exactly if the prompt "
    "contains one, else empty string. Never invent an address.\n"
    "- Keep placeholders such as [EMAIL_1], [URL_1], [PHONE_1] exactly as written.\n"
    "- deadline_offset is POSITIVE relative to send time (default +3d if unstated).\n"
    "- scheduled_offset: empty string to send now, else POSITIVE relative to now.\n"
    "- after_sending offsets are POSITIVE; before_deadline offsets are NEGATIVE.\n"
    "- 0 to 5 reminders, ordered sensibly. Return JSON only."
)

# Gemini structured-output schema (OpenAPI subset). Other providers rely on the system prompt.
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


class ComposeService:
    """Compose a full approval automation from a natural-language prompt."""

    def compose(
        self, credentials: AiProviderCredentials, prompt: str, now: str | None = None
    ) -> ComposeResponse:
        if not (prompt or "").strip():
            raise HTTPException(400, "Describe the approval you want to send first")

        _parse_client_now(now)
        redacted_prompt = redact_contact_details(prompt)
        raw = request_json_text(
            provider=credentials.provider,
            api_key=credentials.api_key,
            model=credentials.model,
            system_prompt=SYSTEM_PROMPT,
            prompt=redacted_prompt.text,
            response_schema=_RESPONSE_SCHEMA,
        )
        plan = self._extract_json(raw)
        restored_plan = self._restore_plan(plan, redacted_prompt.original_by_placeholder)
        return self._materialize(restored_plan, now)

    @staticmethod
    def _restore_plan(plan: dict, original_by_placeholder: dict[str, str]) -> dict:
        def restore(value):
            if isinstance(value, str):
                return restore_contact_details(value, original_by_placeholder)
            if isinstance(value, list):
                return [restore(entry) for entry in value]
            if isinstance(value, dict):
                return {key: restore(entry) for key, entry in value.items()}
            return value

        return restore(plan)

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


compose_service = ComposeService()
