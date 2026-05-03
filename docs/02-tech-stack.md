# Tech Stack

## Architecture: Frontend ↔ Backend Separation

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js       │────▶│   FastAPI       │────▶│   Supabase      │
│   (Vercel)      │     │   (Render)     │     │   (PostgreSQL)  │
│                 │     │                 │     │                 │
│ +TanStack Query │     │ +SQLAlchemy    │     │ +Auth          │
│ +shadcn/ui      │     │ +Brevo API     │     │ +Storage       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                     │
         │              Email (Brevo)
         ▼                     ▼
┌─────────────────┐     ┌─────────────────┐
│   Dashboard    │◀────│   Action Page  │
│   (polling)    │     │   (approve/   │
│               │     │   reject)     │
└─────────────────┘     └─────────────────┘
```

## Frontend (Next.js 14)

| Package | Purpose |
|---------|---------|
| Next.js 14 (App Router) | UI framework, SSR for landing |
| TanStack Query v5 | Server-state, polling, mutations |
| shadcn/ui + Tailwind | Beautiful components |
| @supabase/supabase-js | Auth, Storage uploads |

## Backend (FastAPI)

| Package | Purpose |
|---------|---------|
| FastAPI | REST API |
| SQLAlchemy (async) + asyncpg | Database ORM |
| pydantic | Validation |
| python-jose | JWT validation |
| Brevo API | Transactional emails |

## Infrastructure

| Service | Purpose | Cost |
|---------|---------|------|
| Supabase | PostgreSQL, Auth, Storage | Free |
| Vercel | Next.js hosting | Free |
| Render | FastAPI hosting | $7/mo |
| Render Cron | Reminders | $7/mo |
| Brevo | Email | Free |

Total: ~$7/month (+ domain ~$10/year)