# YesDrop - TODO

## Architecture: Frontend ↔ Backend

- **Frontend**: Next.js + TanStack Query + shadcn/ui (Vercel)
- **Backend**: FastAPI + SQLAlchemy + Brevo API (Render)

---

## Phase 1: Scaffold

### T-001F: Frontend Setup
**Context**: Frontend Next.js project
**Requirements**:
- Next.js 14+ with TypeScript, Tailwind
- Install @supabase/supabase-js, @tanstack/react-query
- Initialize shadcn/ui
- Create env files
**Criteria/Output**: Frontend runs at localhost:3000

### T-001B: Backend Setup
**Context**: FastAPI backend
**Requirements**:
- Create backend/ directory
- Create requirements.txt
- Create .env template
- Create main.py with app
**Criteria/Output**: Backend runs at localhost:8000

---

## Phase 2: Authentication

### T-002F: Frontend Auth (Supabase)
**Context**: Google OAuth sign-up
**Requirements**:
- Configure Supabase client in src/lib/supabase.ts
- Create sign-in page
- Handle OAuth redirect
**Criteria/Output**: User can sign in with Google

### T-002B: Backend JWT Validation
**Context**: Validate Supabase tokens
**Requirements**:
- Auth dependency that extracts Bearer token
- Fetch JWKS from Supabase
- Decode JWT
- Return user_id
**Criteria/Output**: Protected endpoints validate tokens

### T-003: Protected Routes
**Context**: Redirect unauthenticated users
**Requirements**:
- Check auth state
- Redirect to login if needed
**Criteria/Output**: Dashboard protected

---

## Phase 3: Core API Endpoints

### T-004: POST /api/requests
**Context**: Create approval request
**Requirements**:
- Validate: approver_email, title, message?, file_url?
- Generate unique token
- Insert to database
- Check 5 request limit
- Send email via Brevo
- Return created request
**Criteria/Output**: Request created, email sent

### T-005: GET /api/requests
**Context**: List user's requests
**Requirements**:
- Return all requests for logged-in user
- Order by newest first
**Criteria/Output**: Returns array of requests

### T-006: GET /action
**Context**: Public approve/reject endpoint
**Requirements**:
- Read token and action from query params
- Update status in database
- Return "Thank you" HTML
**Criteria/Output**: Status updated

---

## Phase 4: Frontend Features

### T-007: Dashboard View
**Context**: Show requests with polling
**Requirements**:
- TanStack Query fetch requests
- refetchInterval: 5000
- Cards with status badges
**Criteria/Output**: Dashboard shows requests, updates every 5s

### T-008: Create Request Form
**Context**: Form to create request
**Requirements**:
- Fields: approver_email, title, message, file upload
- Upload to Supabase Storage
- POST to backend
- Invalidate queries on success
**Criteria/Output**: Form creates request

### T-009: File Upload
**Context**: Upload files to Supabase
**Requirements**:
- File drop zone
- Upload to approval-files bucket
- Get public URL
**Criteria/Output**: Returns file URL

---

## Phase 5: Deployment

### T-010: Deploy Frontend
**Context**: Deploy to Vercel
**Requirements**:
- Push to GitHub
- Import to Vercel
- Set env vars
- Configure domain
**Criteria/Output**: Live at [domain]

### T-011: Deploy Backend
**Context**: Deploy to Render
**Requirements**:
- Create Web Service
- Set build/start commands
- Set env vars
**Criteria/Output**: Backend live

### T-012: Cron Job
**Context**: Reminder cron
**Requirements**:
- Add Cron Job service
- Create /api/cron/reminders
- Configure schedule
**Criteria/Output**: Reminders sent

### T-013: Email Deliverability
**Context**: Configure DNS
**Requirements**:
- SPF record
- DKIM record
**Criteria/Output**: Emails delivered

### T-014: End-to-End Testing
**Context**: Verify full flow
**Requirements**:
- Sign up with Google
- Create request
- Check email
- Click approve/reject
- Verify dashboard updates
**Criteria/Output**: All steps working

---

## Priority Order

| Phase | Tickets |
|-------|---------|
| 1. Setup | T-001F, T-001B |
| 2. Auth | T-002F, T-002B, T-003 |
| 3. API | T-004, T-005, T-006 |
| 4. Frontend | T-007, T-008, T-009 |
| 5. Deploy | T-010, T-011, T-012, T-013, T-014 |