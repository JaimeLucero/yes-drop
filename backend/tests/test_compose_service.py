"""Unit tests for compose materialization (pure logic, no network)."""

import pytest
from fastapi import HTTPException

from services.compose_service import compose_service

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
    r = compose_service._materialize(plan, NOW)

    assert r.approver_email == "jane@acme.com"
    assert r.title == "Q3 budget approval"
    assert r.scheduled_send_at is not None and r.scheduled_send_at.startswith("2030-06-01")
    assert r.deadline is not None
    assert len(r.reminders) == 2
    assert r.reminders[0].send_at < r.reminders[1].send_at  # sorted
    for rem in r.reminders:
        assert rem.send_at < r.deadline  # bounded by deadline


def test_empty_scheduled_offset_means_send_now():
    r = compose_service._materialize(
        {"title": "T", "message": "m", "scheduled_offset": "", "reminders": []}, NOW
    )
    assert r.scheduled_send_at is None
    assert r.deadline is not None  # defaults to +3d


def test_missing_deadline_offset_defaults():
    r = compose_service._materialize({"title": "T", "message": "m"}, NOW)
    assert r.deadline is not None
    assert r.scheduled_send_at is None


def test_empty_approver_email_becomes_none():
    r = compose_service._materialize(
        {"title": "T", "message": "m", "approver_email": "  "}, NOW
    )
    assert r.approver_email is None


def test_missing_title_raises_502():
    with pytest.raises(HTTPException) as exc:
        compose_service._materialize({"message": "no title"}, NOW)
    assert exc.value.status_code == 502


def test_invalid_offsets_are_skipped_not_fatal():
    r = compose_service._materialize(
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
    assert compose_service._extract_json('```json\n{"a": 1}\n```')["a"] == 1


def test_extract_json_unreadable_raises_502():
    with pytest.raises(HTTPException) as exc:
        compose_service._extract_json("no json here")
    assert exc.value.status_code == 502


def test_redaction_removes_contact_details_before_provider_call():
    from services.compose_service import redact_contact_details

    redacted = redact_contact_details(
        "Ask jane@acme.com (call +1 415 555 0100, see https://acme.com/doc) to approve"
    )

    assert "jane@acme.com" not in redacted.text
    assert "555" not in redacted.text
    assert "acme.com" not in redacted.text
    assert set(redacted.original_by_placeholder.values()) == {
        "jane@acme.com",
        "+1 415 555 0100",
        "https://acme.com/doc",
    }


def test_restore_puts_original_email_back_into_plan():
    plan = {"title": "T", "message": "Hi [EMAIL_1]", "approver_email": "[EMAIL_1]"}

    restored = compose_service._restore_plan(plan, {"[EMAIL_1]": "jane@acme.com"})

    assert restored["approver_email"] == "jane@acme.com"
    assert restored["message"] == "Hi jane@acme.com"


def test_huge_offset_is_dropped_instead_of_crashing():
    r = compose_service._materialize(
        {"title": "T", "message": "m", "deadline_offset": "+999999999999d", "reminders": []},
        NOW,
    )

    assert r.deadline is not None  # falls back to the +3d default


def test_malformed_client_time_is_rejected_with_400():
    from services.compose_service import _parse_client_now

    with pytest.raises(HTTPException) as error:
        _parse_client_now("not-a-date")

    assert error.value.status_code == 400


def test_far_future_client_time_is_rejected_with_400():
    from services.compose_service import _parse_client_now

    with pytest.raises(HTTPException) as error:
        _parse_client_now("9999-12-31T00:00:00+00:00")

    assert error.value.status_code == 400


def test_oversized_prompt_is_rejected_by_schema():
    from pydantic import ValidationError

    from models.schemas import MAX_COMPOSE_PROMPT_LENGTH, ComposeRequest

    with pytest.raises(ValidationError):
        ComposeRequest(prompt="a" * (MAX_COMPOSE_PROMPT_LENGTH + 1))
