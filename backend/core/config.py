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
    BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8000")

    # Public origin for images embedded in outbound email. Must be reachable
    # from the open internet: mail clients proxy images through their own
    # servers (Gmail via googleusercontent), so a localhost FRONTEND_URL in
    # local dev renders a broken image. Always points at the deployed origin.
    EMAIL_ASSET_BASE_URL: str = os.getenv(
        "EMAIL_ASSET_BASE_URL", "https://www.yesdrop.online"
    ).rstrip("/")
    CORS_ORIGINS: list[str] = os.getenv("FRONTEND_URL", "http://localhost:3000,http://127.0.0.1:3000").split(",")

    CRON_SECRET: str | None = os.getenv("CRON_SECRET")

    # Outbound provider for approval emails: "brevo" or "gmail".
    # Default brevo while Gmail OAuth verification is pending; flip to "gmail"
    # (here + NEXT_PUBLIC_SEND_PROVIDER on the frontend) once verified.
    SEND_PROVIDER: str = os.getenv("SEND_PROVIDER", "brevo")

    # Google OAuth (Gmail send). Same client the Supabase Google provider uses.
    GOOGLE_CLIENT_ID: str | None = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: str | None = os.getenv("GOOGLE_CLIENT_SECRET")
    # Fernet key (urlsafe base64, 32 bytes) for encrypting stored refresh tokens.
    TOKEN_ENC_KEY: str | None = os.getenv("TOKEN_ENC_KEY")

    # Per-user AI rate limits. Users bring their own provider key, so these only
    # guard against runaway loops burning the user's own quota.
    AI_RPM_USER: int = int(os.getenv("AI_RPM_USER", "3"))
    AI_RPD_USER: int = int(os.getenv("AI_RPD_USER", "15"))


settings = Settings()
