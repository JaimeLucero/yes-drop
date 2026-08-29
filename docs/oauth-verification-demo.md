# Gmail OAuth verification: demo recording runbook

Google rejected the verification for project `yes-drop` (OAuth client
`788299810813-…apps.googleusercontent.com`, sensitive scope `gmail.send`) with:

1. Demo video does not show the OAuth consent screen workflow.
2. Video does not sufficiently demonstrate app functionality.

**Why the first video failed:** production runs `SEND_PROVIDER=brevo`, which hides
the whole Gmail path: the "Connect Gmail" consent trigger returns `null`
(`frontend/src/components/connect-gmail.tsx:32`) and the scoped `gmail.send` send
never runs (`backend/services/requests.py`, gated on `SEND_PROVIDER == "gmail"`).
So a recording against production can't show the consent screen or a real Gmail
send.

This runbook records a new video with the app in **gmail mode**, using the exact
same OAuth client and `gmail.send` scope Google is reviewing. It is for recording
only. This branch (`demo/gmail-oauth-verification`) must not be merged or
deployed. Production stays on `brevo` until Google approves.

---

## 1. One-time setup

**Enable gmail mode locally** (already done on this branch via gitignored files):

- `frontend/.env.local` → `NEXT_PUBLIC_SEND_PROVIDER=gmail`
- `backend/.env.local` → `SEND_PROVIDER=gmail`

**Supabase → Auth → URL Configuration → Redirect URLs:** ensure
`http://localhost:3000/**` is allowlisted (or add both
`http://localhost:3000/auth/callback` and
`http://localhost:3000/auth/callback?connect=gmail`). Without this, Supabase
refuses to redirect back to localhost after Google consent. Site URL can stay
production.

**Force a clean consent screen on camera:** at
<https://myaccount.google.com/permissions>, remove any existing YesDrop / yes-drop
access for the Google account you will demo. `prompt=consent` re-prompts anyway,
but revoking guarantees the full first-grant consent screen (with the scope
listed) appears in the recording.

**Have a second email address** you control to act as the approver, so the video
can show the email delivered and an Approve click.

---

## 2. Start the app locally

```bash
# Terminal A: backend (FastAPI)
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal B: frontend (Next.js)
cd frontend
npm run dev
```

Open <http://localhost:3000>.

Sanity check before recording: sign in with Google once, then confirm
`/settings` shows a connected Gmail address and one real approval email actually
arrives (steps below). If it sends, you are clear to record.

---

## 3. Recording script

Record the two items Google asked for, in one continuous take.

### Item 1: OAuth consent screen workflow

1. Landing page → **Start for free** → **Continue with Google**.
2. Choose the Google account → the **Google consent screen** appears, showing the
   app and the request **"Send email on your behalf"** (`gmail.send`). Pause here
   so it is clearly on screen.
3. Click **Allow / Continue**. You land on `/dashboard`; the app has stored the
   Gmail send grant.
4. Open `/settings` to show the connected **Sending account** (Gmail address),
   proof the scope was granted to this app.

> Alternative that shows the in-app trigger explicitly: sign up with
> email/password, then on `/settings` (or the "Connect Gmail to send" banner on
> `/requests/new`) click **Connect Gmail** → the same Google consent screen.
> This path uses identity linking and needs Supabase **Manual Linking** enabled;
> otherwise it falls back to a full Google re-login. The Continue-with-Google path
> above is the robust default.

### Item 2: app functionality (uses the scope)

5. **New request** → Approver Email = your second address, add a Title and
   Message. (Optionally use the "Compose with AI" box to draft it.)
6. Choose **Send now** → **Send request**.
7. Switch to the approver inbox → show the approval email **delivered from your
   own Gmail address** (not a YesDrop domain). Open it.
8. Click **Approve** in the email → the `/action` confirmation page.
9. Back on `/dashboard`, show the request status flip to **approved**.

Narration to include: "The `gmail.send` scope granted on the consent screen is
what lets YesDrop send this approval email from the user's own Gmail account, so
replies come back to their inbox." That ties the consent screen (item 1) directly
to the functionality (item 2).

---

## 4. After the video

Reply to Google's verification email with the two demo-video links (the same
video can satisfy both items if it shows consent + send end-to-end).

Once Google approves, flip production separately (not this branch):

- Render (backend): `SEND_PROVIDER=gmail`
- Vercel (frontend): `NEXT_PUBLIC_SEND_PROVIDER=gmail`

See the note at `backend/core/config.py` (`SEND_PROVIDER`).
