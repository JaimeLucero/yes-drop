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

    # opencode (reminder schedule generation). OpenAI-compatible gateway.
    # Default to a FREE model ($0/token) so generation never incurs charges.
    OPENCODE_API_KEY: str | None = os.getenv("OPENCODE_API_KEY")
    OPENCODE_MODEL: str = os.getenv("OPENCODE_MODEL", "laguna-s-2.1-free")
    # Tried in order when the primary is unavailable. Free models on this
    # shared gateway fail individually, transiently, and without notice:
    # measured against the real prompt, the same model returned 200 and 503
    # on alternating calls, and the previous default
    # (deepseek-v4-flash-free) still appears in /models while its provider
    # answers "Model is unavailable". One dead model must not take the
    # feature down, so we walk the list. All entries verified free.
    OPENCODE_FALLBACK_MODELS: list[str] = [
        m.strip()
        for m in os.getenv(
            "OPENCODE_FALLBACK_MODELS",
            "nemotron-3-ultra-free,ling-3.0-flash-fin-free,hy3-free,nemotron-3.5-lightning-free",
        ).split(",")
        if m.strip()
    ]
    # Per-attempt timeout. A healthy model answers this prompt in ~5s; a dead
    # one hangs until cut off, so the cap is what keeps the walk affordable.
    OPENCODE_TIMEOUT_S: float = float(os.getenv("OPENCODE_TIMEOUT_S", "20"))
    # Whole-call budget across every attempt. Bounds worst-case latency so a
    # run of unhealthy models can't leave the user waiting minutes.
    OPENCODE_BUDGET_S: float = float(os.getenv("OPENCODE_BUDGET_S", "50"))
    OPENCODE_BASE_URL: str = os.getenv("OPENCODE_BASE_URL", "https://opencode.ai/zen/v1")

    # Gemini (compose an entire approval automation from a prompt). REST API.
    # GEMINI_KEY is the legacy env name already present in .env; GEMINI_API_KEY
    # takes precedence if both are set.
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_KEY")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    GEMINI_BASE_URL: str = os.getenv(
        "GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta"
    )

    # AI rate limits. All calls share ONE free-tier key, so the global caps
    # protect the provider quota; per-user caps are fairness/abuse guards.
    # Conservative defaults sit under a typical free-tier RPM (~10-15).
    AI_RPM_USER: int = int(os.getenv("AI_RPM_USER", "3"))
    AI_RPD_USER: int = int(os.getenv("AI_RPD_USER", "15"))
    AI_RPM_GLOBAL: int = int(os.getenv("AI_RPM_GLOBAL", "8"))
    AI_RPD_GLOBAL: int = int(os.getenv("AI_RPD_GLOBAL", "200"))


settings = Settings()
