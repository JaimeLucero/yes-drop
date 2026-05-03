# YesDrop - Project Overview

## Value Proposition

Send any document or request for approval with one click, and get a clear "yes" or "no" without ever sending a follow-up email.

## User Flow

1. **Sign Up** - User signs up with Google via Supabase Auth (one click)
2. **Dashboard** - User sees pending approvals with live status
3. **New Request** - User fills in approver email + title, optionally attaches file
4. **Send** - Approver receives email with Approve/Reject buttons
5. **Approval** - Approver clicks button → status updates via polling (5s interval)
6. **Done** - Requester sees status change on dashboard

## Pain Solved

- No more follow-up emails
- No manual status tracking
- Approver never needs to create an account
- Clean, polished UI (shadcn/ui)

## Core Features (v1)

- Google OAuth via Supabase Auth
- Single approver per request
- File attachments via Supabase Storage
- Dashboard with polling (TanStack Query, 5s interval)
- Approval emails via Brevo API
- Hardcoded free limit (5 approvals/month)
- Reminder emails via cron