# YesDrop Backend

## Requirements

```
fastapi>=0.100
uvicorn[standard]>=0.23
sqlalchemy[asyncio]>=2.0
asyncpg>=0.28
python-jose[cryptography]>=3.3
pydantic>=2.0
brevo-python>=7.0
python-multipart>=0.0
httpx>=0.24
python-dotenv>=1.0
```

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

## Environment Variables

Create `.env` in backend directory:

```
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/yesdrop
BREVO_API_KEY=your-brevo-api-key
CRON_SECRET=your-random-secret
SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/jwks
```