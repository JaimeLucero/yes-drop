"""Unit tests for Gemini compose materialization (pure logic, no network)."""

import pytest
from fastapi import HTTPException

from services.gemini_service import gemini_service

# Fixed origin far in the future so offsets are unambiguously ahead of the real
# clock (materialize filters out reminders at/before datetime.now).
NOW = "2030-06-01T00:00:00+00:00"


def test_full_plan_schedules_and_bounds_reminders():
    plan = {
        "title": "Q3 budget approval",
        "message": "Please approve.",
        "approver_email": "jane@acme.com",
        "deadline_offset": "+3d",
        "scheduled_offset": "+2h",
        "reminders": [
            {"kind": "after_sending", "offset": "+1d"},
            {"kind": "before_deadline", "offset": "-1d"},
            {"kind": "bogus", "offset": "+1d"},          # dropped: bad kind
            {"kind": "after_sending", "offset": "+99d"},  # dropped: past deadline
        ],
    }
    r = gemini_service._materialize(plan, NOW)

    assert r.approver_email == "jane@acme.com"
    assert r.title == "Q3 budget approval"
    assert r.scheduled_send_at is not None and r.scheduled_send_at.startswith("2030-06-01")
    assert r.deadline is not None
    assert len(r.reminders) == 2
    assert r.reminders[0].send_at < r.reminders[1].send_at  # sorted
    for rem in r.reminders:
        assert rem.send_at < r.deadline  # bounded by deadline


def test_empty_scheduled_offset_means_send_now():
    r = gemini_service._materialize(
        {"title": "T", "message": "m", "scheduled_offset": "", "reminders": []}, NOW
    )
    assert r.scheduled_send_at is None
    assert r.deadline is not None  # defaults to +3d


def test_missing_deadline_offset_defaults():
    r = gemini_service._materialize({"title": "T", "message": "m"}, NOW)
    assert r.deadline is not None
    assert r.scheduled_send_at is None


def test_empty_approver_email_becomes_none():
    r = gemini_service._materialize(
        {"title": "T", "message": "m", "approver_email": "  "}, NOW
    )
    assert r.approver_email is None


def test_missing_title_raises_502():
    with pytest.raises(HTTPException) as exc:
        gemini_service._materialize({"message": "no title"}, NOW)
    assert exc.value.status_code == 502


def test_invalid_offsets_are_skipped_not_fatal():
    r = gemini_service._materialize(
        {
            "title": "T",
            "message": "m",
            "deadline_offset": "garbage",   # falls back to +3d
            "scheduled_offset": "nonsense",  # ignored -> send now
            "reminders": [{"kind": "after_sending", "offset": "bad"}],  # dropped
        },
        NOW,
    )
    assert r.deadline is not None
    assert r.scheduled_send_at is None
    assert r.reminders == []


def test_extract_json_strips_code_fences():
    assert gemini_service._extract_json('```json\n{"a": 1}\n```')["a"] == 1


def test_extract_json_unreadable_raises_502():
    with pytest.raises(HTTPException) as exc:
        gemini_service._extract_json("no json here")
    assert exc.value.status_code == 502
