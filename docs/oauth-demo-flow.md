# YesDrop — OAuth verification demo video script

Camera-ready shot list for the re-submission. One continuous screen recording
(~2-3 min) covers both items Google asked for:

1. The OAuth consent screen workflow (shows the `gmail.send` scope).
2. The app functionality that uses the scope (send an approval email from the
   user's own Gmail, and get a decision back).

Record with voiceover or on-screen captions. Keep the browser URL bar visible the
whole time.

---

## Pre-record checklist (do these first, off-camera)

- [ ] App running in **gmail mode**: backend `SEND_PROVIDER=gmail`, frontend
      `NEXT_PUBLIC_SEND_PROVIDER=gmail` (already set on branch
      `demo/gmail-oauth-verification` via `.env.local`). Backend on
      `http://localhost:8000`, frontend on `http://localhost:3000`.
- [ ] **Revoke any prior grant** so the full scope card renders on camera:
      <https://myaccount.google.com/permissions> → remove **YesDrop** for the
      Google account you will demo. (Skip and you get the condensed "signing back
      in" screen with no scope card — the exact reason the first video failed.)
- [ ] **Supabase → Auth → URL Configuration → Redirect URLs** includes
      `http://localhost:3000/**`, so Google can redirect back after consent.
- [ ] A **second email address** you control, open in another tab/window, to be
      the approver.
- [ ] Screen recorder ready (QuickTime / Loom / OBS). Zoom the browser to ~110%
      so text is legible.

---

## Part 1 — OAuth consent screen workflow

**Shot 1 — Landing page.**
- Go to `http://localhost:3000`.
- Say: "This is YesDrop. It sends approval-request emails from the user's own
  Gmail, so I'll sign in and grant that permission."

**Shot 2 — Start sign-in.**
- Click **Start for free** (or **Sign in**) → the login page.
- Click **Continue with Google**.

**Shot 3 — Google account chooser.**
- Google shows **"Choose an account — to continue to YesDrop"** with the app's
  Privacy Policy and Terms links. Pause ~2s.
- Pick the account. (If the "Google hasn't verified this app" screen appears,
  click **Advanced → Go to YesDrop (unsafe)** — this is expected while
  verification is pending; narrate that.)

**Shot 4 — The consent / scope screen (the key shot).**
- Google shows the consent card. Pause ~3s on the line
  **"Send email on your behalf"** (the `gmail.send` scope). This is the screen
  Google asked to see.
- Say: "Here YesDrop requests the Gmail send scope — permission to send email on
  my behalf. I'll allow it."
- Click **Continue / Allow**.

**Shot 5 — Back in the app, connected.**
- You land on `/dashboard`.
- Open **Settings** (`/settings`). Point to the **Sending account** card showing
  the connected Gmail address.
- Say: "The Gmail account is now connected as the sending account."

---

## Part 2 — App functionality (uses the scope)

**Shot 6 — Create an approval request.**
- Click **New request** (`/requests/new`).
- (Optional, shows more functionality) In **Compose with AI**, type something like
  "Ask my manager to approve the Q3 budget by Friday" and click **Compose** to
  auto-fill the form.
- Fill/confirm: **Approver Email** = your second address, a **Title**, and a short
  **Message**.
- Say: "I'll send an approval request to my approver."

**Shot 7 — Send it.**
- Choose **Send now** → click **Send request**. You return to `/dashboard` with the
  request listed as pending.

**Shot 8 — Show it delivered from the user's Gmail.**
- Switch to the approver inbox. Open the received email.
- Point out the **From** address = your own Gmail (not a YesDrop domain).
- Say: "The email was sent from my own Gmail using the scope I just granted — this
  is exactly what the Gmail send permission is used for."

**Shot 9 — Approve.**
- In the email, click **Approve** → the `/action` confirmation page → confirm.
- Say: "The approver responds with one click."

**Shot 10 — Decision tracked.**
- Back on `/dashboard`, show the request status now **approved**.
- Say: "The decision is tracked back in YesDrop. That's the full workflow — the
  Gmail send scope powers the approval emails."

---

## Closing

- End on the dashboard showing the approved request.
- Stop recording.

## What to submit

Reply to Google's verification email with the video link. The same video answers
both items (consent screen in Part 1, functionality in Part 2). If they want two
links, submit the same URL for both, or cut Part 1 and Part 2 as two clips.

## Tips

- Do it in **one take** if you can — reviewers like an uninterrupted flow.
- Keep the **URL bar visible** during the Google screens so the consent domain and
  the return to your app are clear.
- If the consent card does NOT show "Send email on your behalf" and instead says
  "signing back in," you skipped the revoke step — redo the pre-record checklist.
