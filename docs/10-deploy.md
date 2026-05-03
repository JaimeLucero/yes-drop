# Deployment

## Frontend: Vercel

### Deploy Steps
1. Push code to GitHub
2. Import project on Vercel
3. Configure build:
   - Build command: `npm run build`
   - Output directory: `.next`
4. Set environment variables:
```
NEXT_PUBLIC_SUPABASE_URL=xxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXT_PUBLIC_BACKEND_URL=https://yesdrop-backend.onrender.com
```

### Domain
- Connect custom domain via Vercel dashboard

---

## Backend: Render

### Deploy Steps
1. Create Web Service on Render
2. Connect GitHub repo (backend/ directory)
3. Build command: `cd backend && pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Environment variables:
```
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/yesdrop
BREVO_API_KEY=xxx
CRON_SECRET=xxx
SUPABASE_JWKS_URL=https://xxx.supabase.co/auth/v1/jwks
```

### Cron Job
1. Add Cron Job service ($7/mo)
2. Schedule: every 30 minutes
3. URL: `https://yesdrop-backend.onrender.com/api/cron/reminders`

---

## Email Deliverability

### Brevo DNS Setup
1. Add SPF record: `v=spf1 include:spf.brevo.com ~all`
2. Add DKIM record from Brevo dashboard

---

## Testing End-to-End

1. Sign up with Google
2. Create test request
3. Check email arrives
4. Click Approve/Reject
5. Verify dashboard updates (within 5s)