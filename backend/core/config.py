import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env first, then .env.local (overrides .env)
base_dir = Path(__file__).resolve().parent.parent
load_dotenv(base_dir / ".env")
load_dotenv(base_dir / ".env.local")


class Settings:
    BREVO_API_KEY: str | None = os.getenv("BREVO_API_KEY")
    BREVO_SENDER_EMAIL: str | None = os.getenv("BREVO_SENDER_EMAIL")
    BREVO_SENDER_NAME: str = os.getenv("BREVO_SENDER_NAME", "YesDrop")

    SUPABASE_JWKS_URL: str | None = os.getenv("SUPABASE_JWKS_URL")
    SUPABASE_AUDIENCE: str | None = os.getenv("SUPABASE_AUDIENCE")
    SUPABASE_URL: str | None = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY: str | None = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    DATABASE_URL: str | None = os.getenv("DATABASE_URL")

    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

    CRON_SECRET: str | None = os.getenv("CRON_SECRET")


settings = Settings()
