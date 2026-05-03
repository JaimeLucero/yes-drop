# YesDrop

Approval request management system with email notifications.

## Architecture

- **Frontend**: Next.js + TanStack Query + shadcn/ui (Vercel)
- **Backend**: FastAPI + Brevo SDK (Render)

## Project Structure

```
yes-drop/
├── frontend/          # Next.js application
│   ├── src/
│   │   ├── app/      # Pages
│   │   ├── components/
│   │   └── lib/      # Utilities, API client
│   └── package.json
├── backend/          # FastAPI application
│   ├── main.py       # App entry, routes
│   ├── auth/         # Authentication (JWT validation)
│   ├── services/     # Business logic (email service)
│   ├── models/       # Pydantic schemas
│   ├── core/         # Configuration
│   └── requirements.txt
└── Makefile
```

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.12+
- Supabase project (for auth)
- Brevo account (for emails)

### 1. Frontend Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local  # Update with your Supabase credentials
npm run dev
```

### 2. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Update with your Brevo API key
uvicorn main:app --reload --port 8000
```

### Using Make

```bash
make setup        # Full project setup
make install      # Install all dependencies
make run          # Run both frontend and backend
make run-frontend # Run frontend only
make run-backend  # Run backend only
make lint         # Run linter
```

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### Backend (.env)
```
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER_EMAIL=optional-custom-sender
BREVO_SENDER_NAME=YesDrop

SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/jwks
SUPABASE_AUDIENCE=https://your-project.supabase.co

FRONTEND_URL=http://localhost:3000
CRON_SECRET=your-secret
```

## API Endpoints

- `POST /api/requests` - Create approval request
- `GET /api/requests` - List user's requests
- `GET /action` - Handle approve/reject (public)
- `POST /api/cron/reminders` - Send reminders (cron)
- `GET /health` - Health check

## Email Configuration

By default, uses Brevo's shared sender domain. For production:

1. Authenticate your domain in Brevo dashboard
2. Set `BREVO_SENDER_EMAIL` in `.env`
3. Emails will send from your domain with reply-to set to requester

## Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Import repo to [Vercel](https://vercel.com/new)
3. Set **Root Directory** to `frontend`
4. Add environment variables from "Frontend (.env.local)" section
5. Add custom domain in Vercel dashboard → Settings → Domains

### Backend (Render)

1. Push code to GitHub
2. Create new **Web Service** on [Render](https://render.com)
3. Connect your GitHub repo
4. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Environment**: Python 3
5. Add environment variables from "Backend (.env)" section:
   - `BREVO_API_KEY`
   - `SUPABASE_JWKS_URL` (e.g., `https://your-project.supabase.co/auth/v1/.well-known/jwks.json`)
   - `SUPABASE_AUDIENCE` (e.g., `authenticated`)
   - `FRONTEND_URL` (your Vercel domain, e.g., `https://yesdrop.online`)
   - `CRON_SECRET` (generate a random secret)
6. Deploy

Alternatively, use the provided `render.yaml` file for Infrastructure as Code setup.

### Post-Deployment

1. Update frontend's `NEXT_PUBLIC_BACKEND_URL` to your Render service URL
2. Test the full OAuth flow end-to-end
3. Monitor logs in both Vercel and Render dashboards
