"""Unit tests for AI rate-limit enforcement (repository counts mocked)."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from core.config import settings
import services.ai_rate_limit as rl


@pytest.fixture
def caps(monkeypatch):
    """Deterministic caps regardless of env overrides."""
    monkeypatch.setattr(settings, "AI_RPM_USER", 3)
    monkeypatch.setattr(settings, "AI_RPD_USER", 15)
    monkeypatch.setattr(settings, "AI_RPM_GLOBAL", 8)
    monkeypatch.setattr(settings, "AI_RPD_GLOBAL", 200)


def _is_minute(since_iso: str) -> bool:
    """The 1-minute window's floor is ~now; the 1-day floor is ~24h back."""
    since = datetime.fromisoformat(since_iso)
    return since >= datetime.now(timezone.utc) - timedelta(hours=1)


def _mock_counts(monkeypatch, user_min, user_day, global_min, global_day):
    monkeypatch.setattr(
        rl.repository,
        "count_ai_usage",
        lambda _uid, since: user_min if _is_minute(since) else user_day,
    )
    monkeypatch.setattr(
        rl.repository,
        "count_ai_usage_global",
        lambda since: global_min if _is_minute(since) else global_day,
    )


def test_under_all_caps_passes(monkeypatch, caps):
    _mock_counts(monkeypatch, user_min=0, user_day=0, global_min=0, global_day=0)
    rl.enforce_ai_rate_limit("user-1")  # no raise


def test_user_minute_cap_trips(monkeypatch, caps):
    _mock_counts(monkeypatch, user_min=3, user_day=3, global_min=0, global_day=0)
    with pytest.raises(HTTPException) as exc:
        rl.enforce_ai_rate_limit("user-1")
    assert exc.value.status_code == 429
    assert exc.value.detail["scope"] == "user"


def test_user_day_cap_trips(monkeypatch, caps):
    _mock_counts(monkeypatch, user_min=0, user_day=15, global_min=0, global_day=0)
    with pytest.raises(HTTPException) as exc:
        rl.enforce_ai_rate_limit("user-1")
    assert exc.value.status_code == 429
    assert exc.value.detail["scope"] == "user"


def test_global_minute_cap_trips(monkeypatch, caps):
    _mock_counts(monkeypatch, user_min=0, user_day=0, global_min=8, global_day=0)
    with pytest.raises(HTTPException) as exc:
        rl.enforce_ai_rate_limit("user-1")
    assert exc.value.status_code == 429
    assert exc.value.detail["scope"] == "global"


def test_global_day_cap_trips(monkeypatch, caps):
    _mock_counts(monkeypatch, user_min=0, user_day=0, global_min=0, global_day=200)
    with pytest.raises(HTTPException) as exc:
        rl.enforce_ai_rate_limit("user-1")
    assert exc.value.status_code == 429
    assert exc.value.detail["scope"] == "global"


def test_user_checked_before_global(monkeypatch, caps):
    # Both user and global over: user scope wins (checked first).
    _mock_counts(monkeypatch, user_min=3, user_day=3, global_min=8, global_day=200)
    with pytest.raises(HTTPException) as exc:
        rl.enforce_ai_rate_limit("user-1")
    assert exc.value.detail["scope"] == "user"
