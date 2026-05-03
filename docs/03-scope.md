# Scope - In vs Out

## In (Build Today - MVP)

### Frontend
- Google OAuth via Supabase (frontend)
- Dashboard with polling (TanStack Query)
- File upload to Supabase Storage
- shadcn/ui components

### Backend
- POST /api/requests - Create approval request
- GET /api/requests - List user's requests  
- GET /action - Public approve/reject endpoint
- Brevo API integration
- Hardcoded 5 request limit/month
- Reminder cron endpoint

## Out (v2+)

- Custom auth (email/password)
- Real-time push (WebSockets)
- Multi-step approvals
- Multiple approvers per request
- In-app billing
- Advanced reminder logic
- Expiring links

## Architecture Changes

| Old (Monolith) | New (Separation) |
|---------------|-----------------|
| Supabase Auth | Supabase Auth (frontend only) |
| Next.js API routes | FastAPI backend |
| Supabase Realtime | TanStack Query polling |
| nodemailer | Brevo API |