"""Regression tests for approval-request service fixes.

Covers the bugs fixed in the deep-check pass:
- process_action status guard + idempotency (no re-decide / dup notify).
- scheduled_send_at validation returns 400 (not a 500 from a bare ValueError).
- deadline_days schema bounds.
- atomic claim on scheduled send prevents double-send.

The repository, email service, and module helpers are monkeypatched — no DB or
network — mirroring tests/test_ai_rate_limit.py.
"""

from datetime import datetime, timezone

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

import services.requests as R
from models.schemas import ApprovalRequestCreate, ApprovalRequestUpdate


def _req(**over):
    """A minimal approval_requests row."""
    base = {
        "id": "req-1",
        "user_id": "user-1",
        "token": "tok-1",
        "status": "pending",
        "title": "T",
        "approver_email": "a@x.com",
        "requester_email": "r@x.com",
        "message": None,
        "file_url": None,
        "response_file_url": None,
        "deadline_days": 3,
    }
    base.update(over)
    return base


@pytest.fixture
def sent(monkeypatch):
    """Capture status-notification sends; patch the async method to a no-op."""
    calls = []

    async def _notify(**kwargs):
        calls.append(kwargs)
        return True

    monkeypatch.setattr(R.email_service, "send_status_notification", _notify)
    return calls


# ---------------------------------------------------------------------------
# process_action: status guard + idempotency (H2)
# ---------------------------------------------------------------------------

async def test_process_action_pending_approves_once(monkeypatch, sent):
    events = []
    monkeypatch.setattr(R.repository, "get_by_token", lambda t: _req())
    monkeypatch.setattr(
        R.repository, "claim_decision", lambda rid, ns, ts: _req(status=ns)
    )
    monkeypatch.setattr(
        R.repository, "cancel_pending_reminders", lambda rid: events.append(("cancel", rid))
    )
    monkeypatch.setattr(
        R.repository, "add_feedback", lambda **k: events.append(("fb", k))
    )

    status, html = await R.service.process_action("tok-1", "approve", feedback="ok")

    assert status == "approved"
    assert "Approved" in html
    assert len(sent) == 1                       # requester notified exactly once
    assert ("cancel", "req-1") in events        # pending reminders cancelled


async def test_process_action_already_decided_is_idempotent(monkeypatch, sent):
    attempted = []
    monkeypatch.setattr(R.repository, "get_by_token", lambda t: _req(status="approved"))
    monkeypatch.setattr(
        R.repository, "claim_decision", lambda *a: attempted.append(a) or _req()
    )

    status, html = await R.service.process_action("tok-1", "reject")

    assert status == "approved"    # NOT re-flipped to rejected
    assert attempted == []         # no transition even attempted
    assert sent == []              # no duplicate notification


@pytest.mark.parametrize("state", ["draft", "scheduled", "ignored"])
async def test_process_action_non_pending_not_actionable(monkeypatch, sent, state):
    monkeypatch.setattr(R.repository, "get_by_token", lambda t: _req(status=state))

    status, html = await R.service.process_action("tok-1", "approve")

    assert status == state
    assert "not available" in html.lower()
    assert sent == []


async def test_process_action_race_lost_surfaces_winner(monkeypatch, sent):
    # Pending at read, but the atomic claim loses to a concurrent decision.
    reads = [_req(status="pending"), _req(status="approved")]
    monkeypatch.setattr(
        R.repository, "get_by_token", lambda t: reads.pop(0) if len(reads) > 1 else reads[0]
    )
    monkeypatch.setattr(R.repository, "claim_decision", lambda *a: None)

    status, html = await R.service.process_action("tok-1", "reject")

    assert status == "approved"    # shows the winning outcome
    assert sent == []              # loser sends nothing


async def test_process_action_invalid_action():
    with pytest.raises(HTTPException) as exc:
        await R.service.process_action("tok-1", "maybe")
    assert exc.value.status_code == 400


async def test_process_action_invalid_token(monkeypatch):
    monkeypatch.setattr(R.repository, "get_by_token", lambda t: None)
    with pytest.raises(HTTPException) as exc:
        await R.service.process_action("nope", "approve")
    assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# scheduled_send_at validation (H3)
# ---------------------------------------------------------------------------

async def test_create_request_bad_scheduled_returns_400(monkeypatch):
    async def _email(uid):
        return "r@x.com"

    created = []
    monkeypatch.setattr(R, "get_user_email", _email)
    monkeypatch.setattr(R.repository, "create", lambda rec: created.append(rec) or rec)

    body = ApprovalRequestCreate(
        approver_email="a@x.com", title="T", scheduled_send_at="tomorrow"
    )
    with pytest.raises(HTTPException) as exc:
        await R.service.create_request(body, "user-1")

    assert exc.value.status_code == 400        # not a 500 from a bare ValueError
    assert created == []                        # nothing persisted


async def test_update_request_bad_format_returns_400(monkeypatch):
    monkeypatch.setattr(R.repository, "get_by_id", lambda rid: _req(status="draft"))
    updated = []
    monkeypatch.setattr(R.repository, "update", lambda rid, p: updated.append(p) or _req())

    body = ApprovalRequestUpdate(scheduled_send_at="not-a-date")
    with pytest.raises(HTTPException) as exc:
        await R.service.update_request("req-1", body, "user-1")

    assert exc.value.status_code == 400
    assert updated == []


async def test_update_request_past_time_returns_400(monkeypatch):
    monkeypatch.setattr(R.repository, "get_by_id", lambda rid: _req(status="draft"))
    updated = []
    monkeypatch.setattr(R.repository, "update", lambda rid, p: updated.append(p) or _req())

    body = ApprovalRequestUpdate(scheduled_send_at="2000-01-01T00:00:00Z")
    with pytest.raises(HTTPException) as exc:
        await R.service.update_request("req-1", body, "user-1")

    assert exc.value.status_code == 400
    assert updated == []


# ---------------------------------------------------------------------------
# deadline_days schema bounds (H4)
# ---------------------------------------------------------------------------

def test_deadline_days_default_is_three():
    m = ApprovalRequestCreate(approver_email="a@x.com", title="T")
    assert m.deadline_days == 3


@pytest.mark.parametrize("value", [0, -5, 1000, 1_000_000_000])
def test_deadline_days_out_of_range_rejected(value):
    with pytest.raises(ValidationError):
        ApprovalRequestCreate(approver_email="a@x.com", title="T", deadline_days=value)


# ---------------------------------------------------------------------------
# atomic claim prevents double-send (M3)
# ---------------------------------------------------------------------------

def _under_limit(_uid):
    return (0, datetime.now(timezone.utc), None)


async def test_scheduled_send_skips_when_already_claimed(monkeypatch):
    monkeypatch.setattr(R.settings, "CRON_SECRET", "s")
    monkeypatch.setattr(R.settings, "SEND_PROVIDER", "brevo")  # skip gmail gate
    monkeypatch.setattr(R.repository, "get_by_id", lambda rid: _req(status="scheduled"))
    monkeypatch.setattr(R, "get_daily_limit_info", _under_limit)
    monkeypatch.setattr(R.repository, "claim_scheduled_send", lambda rid, data: None)

    sends = []

    async def _send(rec, **k):
        sends.append(rec)

    monkeypatch.setattr(R, "send_approval_email", _send)

    res = await R.service.send_scheduled_internal("req-1", authorization="Bearer s")

    assert res == {"success": False, "reason": "already_sent"}
    assert sends == []          # the loser never sends


async def test_scheduled_send_sends_once_when_claimed(monkeypatch):
    monkeypatch.setattr(R.settings, "CRON_SECRET", "s")
    monkeypatch.setattr(R.settings, "SEND_PROVIDER", "brevo")
    monkeypatch.setattr(R.repository, "get_by_id", lambda rid: _req(status="scheduled"))
    monkeypatch.setattr(R, "get_daily_limit_info", _under_limit)
    monkeypatch.setattr(
        R.repository, "claim_scheduled_send", lambda rid, data: _req(status="pending")
    )

    sends = []

    async def _send(rec, **k):
        sends.append(rec)

    async def _notify(**k):
        return True

    monkeypatch.setattr(R, "send_approval_email", _send)
    monkeypatch.setattr(R.email_service, "send_status_notification", _notify)

    res = await R.service.send_scheduled_internal("req-1", authorization="Bearer s")

    assert res == {"success": True}
    assert len(sends) == 1
