"""Tests for reminder-plan materialization and the opencode model fallback.

No network. The model's JSON is fed in directly so the assertions cover our
contract with it, not the provider's mood:

  - a deadline the user chose is never replaced by a model suggestion
  - a stated clock time ("9 am") lands at that time in the user's zone
  - nothing is invented when the user (or the model) supplied nothing
  - malformed pieces are skipped rather than crashing the request
  - a dead or useless model falls through to the next candidate
"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import httpx
import pytest
from fastapi import HTTPException

from core.config import settings
import services.opencode_service as OS
from services.opencode_service import opencode_service as svc

SENT = datetime(2026, 8, 29, 16, 35, tzinfo=timezone.utc)  # 4:35 PM UTC
DEADLINE = datetime(2026, 9, 3, 16, 35, tzinfo=timezone.utc)
MANILA = "Asia/Manila"  # UTC+8, never observes DST


def plan(reminders, deadline=None):
    return {"deadline": deadline, "reminders": reminders}


def at_9am(days, kind="after_sending"):
    sign = "+" if kind == "after_sending" else "-"
    return [{"kind": kind, "offset": f"{sign}{d}d", "at": "09:00"} for d in days]


# --------------------------------------------------------------------------
# Deadline precedence: the user's choice outranks the model's suggestion.
# --------------------------------------------------------------------------


def test_user_deadline_is_never_overwritten():
    out = svc._materialize(
        plan(at_9am([1, 2]), deadline={"offset": "+7d"}),
        SENT.isoformat(),
        DEADLINE.isoformat(),
        MANILA,
    )
    assert out.deadline == DEADLINE.isoformat()


def test_model_deadline_used_only_when_user_left_it_blank():
    out = svc._materialize(
        plan(at_9am([1]), deadline={"offset": "+7d"}), SENT.isoformat(), None, MANILA
    )
    assert out.deadline == (SENT.replace(day=5, month=9)).isoformat()


def test_no_deadline_anywhere_stays_blank():
    out = svc._materialize(plan(at_9am([1]), deadline=None), SENT.isoformat(), None, MANILA)
    assert out.deadline is None


def test_malformed_model_deadline_does_not_invent_one():
    out = svc._materialize(
        plan(at_9am([1]), deadline={"offset": "garbage"}), SENT.isoformat(), None, MANILA
    )
    assert out.deadline is None


# --------------------------------------------------------------------------
# Clock times: "9 am" means 9 am where the requester is.
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "zone,expected_utc_hhmm",
    [
        ("Asia/Manila", "01:00"),       # UTC+8
        ("America/New_York", "13:00"),  # UTC-4 in August
        ("Europe/London", "08:00"),     # UTC+1 in August
        ("Asia/Kolkata", "03:30"),      # UTC+5:30, half-hour offset
        ("UTC", "09:00"),
    ],
)
def test_at_resolves_in_the_requesters_zone(zone, expected_utc_hhmm):
    out = svc._materialize(plan(at_9am([1])), SENT.isoformat(), DEADLINE.isoformat(), zone)
    assert out.reminders[0].send_at[11:16] == expected_utc_hhmm


def test_at_reads_back_as_9am_local():
    out = svc._materialize(
        plan(at_9am([1, 2, 3])), SENT.isoformat(), DEADLINE.isoformat(), MANILA
    )
    tz = ZoneInfo(MANILA)
    for r in out.reminders:
        local = datetime.fromisoformat(r.send_at).astimezone(tz)
        assert (local.hour, local.minute) == (9, 0)


def test_without_at_the_send_time_of_day_is_kept():
    out = svc._materialize(
        plan([{"kind": "after_sending", "offset": "+1d"}]),
        SENT.isoformat(),
        DEADLINE.isoformat(),
        MANILA,
    )
    assert out.reminders[0].send_at[11:16] == "16:35"


def test_before_deadline_offsets_count_back_from_the_deadline():
    out = svc._materialize(
        plan([{"kind": "before_deadline", "offset": "-1d"}]),
        SENT.isoformat(),
        DEADLINE.isoformat(),
        MANILA,
    )
    assert out.reminders[0].send_at.startswith("2026-09-02")


# --------------------------------------------------------------------------
# Timezone resolution and DST edges.
# --------------------------------------------------------------------------


@pytest.mark.parametrize("bad", [None, "", "Not/AZone", "Mars/Olympus"])
def test_unknown_zone_falls_back_to_utc_not_server_local(bad):
    assert OS._resolve_tz(bad) is timezone.utc or str(OS._resolve_tz(bad)) == "UTC"


def test_dst_spring_forward_shifts_instead_of_crashing():
    ny = ZoneInfo("America/New_York")
    # 02:30 does not exist on 2026-03-08 in New York.
    got = OS._set_wall_clock(datetime(2026, 3, 8, 12, 0, tzinfo=timezone.utc), "02:30", ny)
    assert got.astimezone(ny).hour == 3


def test_dst_fall_back_picks_the_first_occurrence():
    ny = ZoneInfo("America/New_York")
    # 01:30 happens twice on 2026-11-01 in New York.
    got = OS._set_wall_clock(datetime(2026, 11, 1, 12, 0, tzinfo=timezone.utc), "01:30", ny)
    assert got.astimezone(ny).strftime("%H:%M %Z") == "01:30 EDT"


@pytest.mark.parametrize("bad_at", ["25:00", "9am", "09:60", "", "9", "0900"])
def test_invalid_clock_time_is_rejected(bad_at):
    with pytest.raises(ValueError):
        OS._set_wall_clock(SENT, bad_at, timezone.utc)


# --------------------------------------------------------------------------
# Bounds and junk tolerance.
# --------------------------------------------------------------------------


def test_reminder_at_or_after_the_deadline_is_dropped():
    out = svc._materialize(
        plan([{"kind": "after_sending", "offset": "+30d"}]),
        SENT.isoformat(),
        DEADLINE.isoformat(),
        MANILA,
    )
    assert out.reminders == []


def test_reminder_in_the_past_is_dropped():
    past = datetime(2020, 1, 1, tzinfo=timezone.utc)
    out = svc._materialize(
        plan([{"kind": "after_sending", "offset": "+1d"}]),
        past.isoformat(),
        None,
        MANILA,
    )
    assert out.reminders == []


def test_before_deadline_without_a_deadline_is_dropped():
    out = svc._materialize(
        plan([{"kind": "before_deadline", "offset": "-1d"}]), SENT.isoformat(), None, MANILA
    )
    assert out.reminders == []


def test_junk_entries_are_skipped_not_fatal():
    out = svc._materialize(
        plan(
            [
                "not a dict",
                {"kind": "bogus_kind", "offset": "+1d"},
                {"kind": "after_sending", "offset": "nonsense"},
                {"kind": "after_sending", "offset": "+1d", "at": "99:99"},
                {"kind": "after_sending", "offset": "+1d", "at": "09:00"},  # the only good one
            ]
        ),
        SENT.isoformat(),
        DEADLINE.isoformat(),
        MANILA,
    )
    assert len(out.reminders) == 1


def test_results_are_sorted_by_time():
    out = svc._materialize(
        plan(at_9am([3, 1, 2])), SENT.isoformat(), DEADLINE.isoformat(), MANILA
    )
    assert [r.send_at for r in out.reminders] == sorted(r.send_at for r in out.reminders)


def test_custom_message_is_passed_through_but_never_fabricated():
    out = svc._materialize(
        plan(
            [
                {"kind": "after_sending", "offset": "+1d", "custom_message": "Ping"},
                {"kind": "after_sending", "offset": "+2d"},
            ]
        ),
        SENT.isoformat(),
        DEADLINE.isoformat(),
        MANILA,
    )
    assert out.reminders[0].custom_message == "Ping"
    assert out.reminders[1].custom_message is None


# --------------------------------------------------------------------------
# Model fallback walk. httpx is stubbed; no provider is contacted.
# --------------------------------------------------------------------------

GOOD_BODY = {
    "choices": [
        {
            "message": {
                "content": '{"deadline": null, "reminders": '
                '[{"kind": "after_sending", "offset": "+1d", "at": "09:00"}]}'
            }
        }
    ]
}


class _Resp:
    def __init__(self, status, payload=None, text=""):
        self.status_code = status
        self._payload = payload
        self.text = text

    def json(self):
        if self._payload is None:
            raise ValueError("no json")
        return self._payload


@pytest.fixture
def models(monkeypatch):
    monkeypatch.setattr(settings, "OPENCODE_MODEL", "primary")
    monkeypatch.setattr(settings, "OPENCODE_FALLBACK_MODELS", ["second", "third"])
    monkeypatch.setattr(settings, "OPENCODE_API_KEY", "test-key")
    monkeypatch.setattr(settings, "OPENCODE_BUDGET_S", 50.0)


def _record(monkeypatch, responses):
    """Serve `responses` in order, recording which model each call used."""
    seen = []
    it = iter(responses)

    def fake_post(url, headers=None, json=None, timeout=None):
        seen.append(json["model"])
        nxt = next(it)
        if isinstance(nxt, Exception):
            raise nxt
        return nxt

    monkeypatch.setattr(OS.httpx, "post", fake_post)
    return seen


def test_primary_success_never_touches_fallbacks(models, monkeypatch):
    seen = _record(monkeypatch, [_Resp(200, GOOD_BODY)])
    out = svc._call_opencode("ping daily", SENT.isoformat(), DEADLINE.isoformat(), MANILA)
    assert seen == ["primary"]
    assert len(out.reminders) == 1


def test_dead_primary_falls_through_to_the_next_model(models, monkeypatch):
    seen = _record(
        monkeypatch,
        [_Resp(400, text="Model is unavailable."), _Resp(200, GOOD_BODY)],
    )
    out = svc._call_opencode("ping daily", SENT.isoformat(), DEADLINE.isoformat(), MANILA)
    assert seen == ["primary", "second"]
    assert len(out.reminders) == 1


def test_timeout_falls_through(models, monkeypatch):
    seen = _record(
        monkeypatch, [httpx.ReadTimeout("too slow"), _Resp(200, GOOD_BODY)]
    )
    svc._call_opencode("ping daily", SENT.isoformat(), DEADLINE.isoformat(), MANILA)
    assert seen == ["primary", "second"]


def test_empty_schedule_is_treated_as_failure_not_success(models, monkeypatch):
    """A 200 carrying zero reminders must not surface as an empty plan."""
    empty = {"choices": [{"message": {"content": '{"deadline": null, "reminders": []}'}}]}
    seen = _record(monkeypatch, [_Resp(200, empty), _Resp(200, GOOD_BODY)])
    out = svc._call_opencode("ping daily", SENT.isoformat(), DEADLINE.isoformat(), MANILA)
    assert seen == ["primary", "second"]
    assert len(out.reminders) == 1


def test_prose_instead_of_json_falls_through(models, monkeypatch):
    prose = {"choices": [{"message": {"content": "Sure! Here is a plan for you."}}]}
    seen = _record(monkeypatch, [_Resp(200, prose), _Resp(200, GOOD_BODY)])
    svc._call_opencode("ping daily", SENT.isoformat(), DEADLINE.isoformat(), MANILA)
    assert seen == ["primary", "second"]


@pytest.mark.parametrize("status", [401, 403, 429])
def test_key_level_errors_stop_immediately(models, monkeypatch, status):
    """Auth/quota apply to every model, so walking the list only wastes time."""
    seen = _record(monkeypatch, [_Resp(status, text="denied")])
    with pytest.raises(HTTPException) as e:
        svc._call_opencode("ping daily", SENT.isoformat(), DEADLINE.isoformat(), MANILA)
    assert e.value.status_code == 502
    assert seen == ["primary"]


def test_all_models_down_raises_502_after_two_passes(models, monkeypatch):
    seen = _record(monkeypatch, [_Resp(500, text="boom")] * 6)
    with pytest.raises(HTTPException) as e:
        svc._call_opencode("ping daily", SENT.isoformat(), DEADLINE.isoformat(), MANILA)
    assert e.value.status_code == 502
    # Two passes over three models, and no model is tried twice in a row.
    assert seen == ["primary", "second", "third"] * 2


def test_budget_stops_the_walk_early(models, monkeypatch):
    monkeypatch.setattr(settings, "OPENCODE_BUDGET_S", 0.0)
    seen = _record(monkeypatch, [_Resp(200, GOOD_BODY)])
    with pytest.raises(HTTPException):
        svc._call_opencode("ping daily", SENT.isoformat(), DEADLINE.isoformat(), MANILA)
    assert seen == []


def test_blank_intent_is_rejected_before_any_network_call(models, monkeypatch):
    seen = _record(monkeypatch, [])
    with pytest.raises(HTTPException) as e:
        svc.generate_reminder_plan("   ", SENT.isoformat(), DEADLINE.isoformat(), MANILA)
    assert e.value.status_code == 400
    assert seen == []
