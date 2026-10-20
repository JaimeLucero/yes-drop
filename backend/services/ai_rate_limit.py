"""
DB-backed per-user rate limiting for AI generation calls.

Each user spends their own provider key, so the cap only stops runaway loops.
Counts come from the ai_usage table via a Postgres RPC, so the limit is accurate
across multiple gunicorn workers and survives restarts.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from core.config import settings
from services.database import repository


def _too_many(retry_after: int) -> HTTPException:
    return HTTPException(
        429,
        detail={
            "message": "You're generating too fast. Give it a moment and try again.",
            "scope": "user",
            "retry_after_seconds": retry_after,
        },
    )


def enforce_ai_rate_limit(user_id: str) -> None:
    """Raise HTTP 429 if the user is over their minute or day cap. Call BEFORE hitting the provider."""
    now = datetime.now(timezone.utc)
    min_ago = (now - timedelta(minutes=1)).isoformat()
    day_ago = (now - timedelta(days=1)).isoformat()

    if repository.count_ai_usage(user_id, min_ago) >= settings.AI_RPM_USER:
        raise _too_many(60)
    if repository.count_ai_usage(user_id, day_ago) >= settings.AI_RPD_USER:
        raise _too_many(3600)
