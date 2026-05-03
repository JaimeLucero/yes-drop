# YesDrop Deployment Guide

## Prerequisites

- Supabase account (project created)
- Brevo account (API key obtained)
- Render account (for backend hosting)
- Vercel account (for frontend hosting)

---

## 1. Database Setup (Supabase)

### Run Migration

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor** → **New Query**
4. Copy and run the contents of `backend/migrations/002-drafts-scheduled-sends.sql`

This creates:
- Updated status constraint (draft, scheduled, pending, approved, rejected)
- New columns: `scheduled_send_at`, `sent_at`, `approver_email`
- Indexes for performance
- Functions: `get_daily_sent_count()`, `get_next_available_day()`

---

## 2. Backend Deployment (Render)

### Environment Variables

Set these in Render dashboard:

```env
# Supabase
SUPABASE_URL=https://aurhheqwpfpngqmhegvx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<get-from-supabase-dashboard>
SUPABASE_JWKS_URL=https://aurhheqwpfpngqmhegvx.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_AUDIENCE=authenticated
DATABASE_URL=<auto-set-by-render>

# Brevo
BREVO_API_KEY=<your-brevo-api-key>
BREVO_SENDER_NAME=YesDrop
BREVO_SENDER_EMAIL=noreply@yesdrop.online

# Cron
CRON_SECRET=<generate-random-secret>

# Frontend
FRONTEND_URL=https://yesdrop.online
BACKEND_URL=<your-render-url>
```

### Build Configuration

- **Build Command**: `pip install -r requirements.txt && pip install gunicorn`
- **Start Command**: `gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`
- **Root Directory**: `backend`

---

## 3. Edge Function Deployment (Supabase)

### Deploy Function

```bash
cd frontend
npx supabase functions deploy send-scheduled-requests
```

### Set Secrets

```bash
npx supabase secrets set CRON_SECRET=<same-as-backend>
npx supabase secrets set BACKEND_URL=<your-render-url>
```

### Configure Cron Schedule

1. Go to Supabase Dashboard → Edge Functions → `send-scheduled-requests`
2. Click **Schedules** tab
3. Create new schedule:
   - **Cron Expression**: `*/5 * * * *` (every 5 minutes)
   - **Timezone**: UTC
   - **Headers**: `Authorization: Bearer <CRON_SECRET>`

---

## 4. Frontend Deployment (Vercel)

### Environment Variables

Set these in Vercel dashboard:

```env
NEXT_PUBLIC_SUPABASE_URL=https://aurhheqwpfpngqmhegvx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_BACKEND_URL=<your-render-url>
```

### Build Configuration

- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

---

## 5. Supabase Storage Setup

### Create Bucket

1. Go to Supabase Dashboard → **Storage**
2. Click **New Bucket**
3. Name: `approval-files`
4. Check **Public bucket**
5. Click **Create**

### Set RLS Policies

In Storage → `approval-files` → Policies:

1. **Insert Policy**: `bucket_id = 'approval-files' AND auth.uid()::text = owner::text`
2. **Select Policy**: `bucket_id = 'approval-files'`
3. **Delete Policy**: `bucket_id = 'approval-files' AND auth.uid()::text = owner::text`

---

## 6. Testing

### Test Flow

1. **Create Draft**: Go to `/requests/new`, fill form, select "Save as Draft"
2. **Schedule**: Click "Schedule" on draft, pick future date/time
3. **Send Now**: Click "Send Now" on draft (checks daily limit)
4. **Verify Email**: Check approver inbox for approval request
5. **Approve/Reject**: Click link in email, verify status updates
6. **Check Notifications**: Verify status change emails are sent

### Test Daily Limit

1. Create and send 5 requests in one day
2. Try to send 6th → Should be blocked with error
3. Try to schedule for tomorrow → Should work
4. Verify "Next available date" is shown

### Test Auto-Reschedule

1. Schedule 6+ requests for same time tomorrow
2. Wait for Edge Function to run (every 5 min)
3. First 5 should send, rest should auto-reschedule
4. Check emails for reschedule notifications

---

## 7. Monitoring

### Backend Logs (Render)

- Go to Render Dashboard → Your Service → **Logs**
- Watch for errors in email sending, JWT validation

### Edge Function Logs (Supabase)

- Go to Supabase Dashboard → Edge Functions → **Logs**
- Watch for scheduled send executions

### Email Deliverability (Brevo)

- Go to Brevo Dashboard → **Transactional** → **Logs**
- Monitor delivery rates, bounces, complaints

---

## 8. Troubleshooting

### "Daily limit reached" error

- Check `get_daily_sent_count()` function in Supabase
- Verify UTC timezone conversion is correct
- Check if requests are being counted with correct status

### Scheduled requests not sending

- Verify Edge Function cron is running (check logs)
- Check `BACKEND_URL` secret is correct
- Verify CRON_SECRET matches between backend and Edge Function

### Email not sending

- Check BREVO_API_KEY is valid
- Verify sender domain is authenticated in Brevo
- Check Brevo account has available credits

### Database connection errors

- Verify DATABASE_URL is correct (use connection pooling URL from Supabase)
- Check Supabase project is not paused
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct

---

## 9. Production Checklist

- [ ] Database migration ran successfully
- [ ] Storage bucket created with RLS policies
- [ ] Backend deployed to Render
- [ ] All environment variables set in Render
- [ ] Edge Function deployed to Supabase
- [ ] Edge Function secrets configured
- [ ] Supabase cron schedule created
- [ ] Frontend deployed to Vercel
- [ ] Custom domain configured (yesdrop.online)
- [ ] Test full OAuth flow
- [ ] Test email sending (draft → scheduled → sent → approved)
- [ ] Test daily limit enforcement
- [ ] Test auto-reschedule functionality
- [ ] Monitor logs for 24 hours

---

## 10. Cost Estimates

### Free Tier Limits

- **Supabase**: 500MB database, 50K monthly active users
- **Brevo**: 300 emails/day free
- **Render**: 750 hours/month free (enough for 1 service)
- **Vercel**: Unlimited deployments, 100GB bandwidth/month

### Expected Monthly Cost

- Supabase: Free (for MVP)
- Brevo: Free (up to 300 emails/day)
- Render: Free (hobby tier) or $7/month (always-on)
- Vercel: Free (hobby tier)

**Total**: $0-7/month depending on usage
