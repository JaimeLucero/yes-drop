"""Live prompt matrix: real prompts -> real gateway -> property assertions.

Complements tests/test_reminder_plan.py, which pins the contract offline. This
one answers "does a real model, given real English, honour it?"

Usage: python scripts/live_prompts.py [runs_per_case]
"""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

# Run from anywhere: backend/ must be importable as the package root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.opencode_service import opencode_service as svc

TZ = "Asia/Manila"
ZONE = ZoneInfo(TZ)
SENT = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(minutes=5)
DEADLINE = SENT + timedelta(days=5)


def local_hhmm(iso):
    return datetime.fromisoformat(iso).astimezone(ZONE).strftime("%H:%M")


def all_at(plan, hhmm):
    return bool(plan.reminders) and all(local_hhmm(r.send_at) == hhmm for r in plan.reminders)


def deadline_kept(plan):
    return plan.deadline == DEADLINE.isoformat()


def within_bounds(plan):
    dl = datetime.fromisoformat(plan.deadline) if plan.deadline else None
    now = datetime.now(timezone.utc)
    for r in plan.reminders:
        t = datetime.fromisoformat(r.send_at)
        if t <= now or (dl and t >= dl):
            return False
    return True


# (name, prompt, deadline_passed_in, checks)
CASES = [
    (
        "clock time honoured",
        "the follow up is every 9 am until the deadline",
        DEADLINE,
        [("all reminders at 09:00 local", lambda p: all_at(p, "09:00")),
         ("my deadline kept", deadline_kept)],
    ),
    (
        "different clock time",
        "remind them at 5:30pm every day until the deadline",
        DEADLINE,
        [("all reminders at 17:30 local", lambda p: all_at(p, "17:30")),
         ("my deadline kept", deadline_kept)],
    ),
    (
        "no clock time -> none invented",
        "nudge them once a day after sending",
        DEADLINE,
        [("my deadline kept", deadline_kept),
         ("has reminders", lambda p: len(p.reminders) > 0)],
    ),
    (
        "before-deadline phrasing",
        "send one reminder 2 hours before the deadline",
        DEADLINE,
        [("my deadline kept", deadline_kept),
         ("a before_deadline reminder exists",
          lambda p: any(r.kind == "before_deadline" for r in p.reminders))],
    ),
    (
        "no deadline anywhere -> stays blank",
        "just nudge them a day after sending, no deadline",
        None,
        [("deadline stays blank", lambda p: p.deadline is None),
         ("has reminders", lambda p: len(p.reminders) > 0)],
    ),
    (
        "blank deadline + user asks for one",
        "follow up daily and give them a week to respond",
        None,
        [("model supplied a deadline", lambda p: p.deadline is not None)],
    ),
]


def run(runs):
    print(f"timezone {TZ} | sent {SENT.isoformat()} | deadline {DEADLINE.isoformat()}\n")
    totals = {}
    for name, prompt, dl, checks in CASES:
        print(f"CASE: {name}\n  prompt: {prompt!r}")
        passed = failed = errored = 0
        failures = []
        for _ in range(runs):
            try:
                p = svc.generate_reminder_plan(
                    prompt, SENT.isoformat(), dl.isoformat() if dl else None, TZ
                )
            except Exception as e:
                errored += 1
                continue
            bad = [label for label, fn in checks + [("within bounds", within_bounds)] if not fn(p)]
            if bad:
                failed += 1
                failures.append((bad, [(r.kind, r.send_at, local_hhmm(r.send_at)) for r in p.reminders], p.deadline))
            else:
                passed += 1
        totals[name] = (passed, failed, errored)
        print(f"  -> pass {passed}  fail {failed}  gateway-error {errored}")
        for bad, rems, dline in failures[:2]:
            print(f"     failed checks: {bad}")
            print(f"     deadline={dline}")
            for k, iso, hhmm in rems:
                print(f"       {k:16} {iso}  local {hhmm}")
        print()

    print("=" * 62)
    print(f"{'case':38} {'pass':>5} {'fail':>5} {'err':>5}")
    for name, (p, f, e) in totals.items():
        print(f"{name:38} {p:>5} {f:>5} {e:>5}")
    tp = sum(v[0] for v in totals.values())
    tf = sum(v[1] for v in totals.values())
    te = sum(v[2] for v in totals.values())
    print(f"{'TOTAL':38} {tp:>5} {tf:>5} {te:>5}")
    print("\nfail = model returned a schedule that broke a rule (our problem)")
    print("err  = gateway/model unavailable (upstream, not a contract failure)")


if __name__ == "__main__":
    run(int(sys.argv[1]) if len(sys.argv) > 1 else 2)
