"""
DB-backed rate limiting for AI generation calls.

All AI calls share ONE free-tier key, so we enforce a global cap (protect the
provider RPM/RPD ceiling across every worker) plus a per-user cap (fairness /
abuse). Counts come from the ai_usage table via Postgres RPCs, so the limit is
accurate across multiple gunicorn workers and survives restarts.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from core.config import settings
from services.database import repository


def _too_many(scope: str, retry_after: int) -> HTTPException:
    msg = (
        "You're generating too fast. Give it a moment and try again."
        if scope == "user"
        else "AI is busy across YesDrop right now. Try again in a bit, or fill the form in manually."
    )
    return HTTPException(
        429,
        detail={"message": msg, "scope": scope, "retry_after_seconds": retry_after},
    )


def enforce_ai_rate_limit(user_id: str) -> None:
    """Raise HTTP 429 if the user or the shared key is over its window caps.

    Checked cheapest-scope-first: per-user minute, per-user day, global minute,
    global day. Call BEFORE hitting the provider.
    """
    now = datetime.now(timezone.utc)
    min_ago = (now - timedelta(minutes=1)).isoformat()
    day_ago = (now - timedelta(days=1)).isoformat()

    if repository.count_ai_usage(user_id, min_ago) >= settings.AI_RPM_USER:
        raise _too_many("user", 60)
    if repository.count_ai_usage(user_id, day_ago) >= settings.AI_RPD_USER:
        raise _too_many("user", 3600)
    if repository.count_ai_usage_global(min_ago) >= settings.AI_RPM_GLOBAL:
        raise _too_many("global", 60)
    if repository.count_ai_usage_global(day_ago) >= settings.AI_RPD_GLOBAL:
        raise _too_many("global", 3600)
