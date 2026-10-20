"""Per-user AI provider key storage. Keys are encrypted at rest and never returned to clients."""

from dataclasses import dataclass
from datetime import datetime, timezone

from services.database import supabase
from services.secret_encryption import decrypt_secret, encrypt_secret

TABLE_NAME = "ai_provider_keys"


@dataclass(frozen=True)
class AiProviderCredentials:
    provider: str
    model: str
    api_key: str


class AiProviderKeyStore:
    def save(self, user_id: str, provider: str, model: str, api_key: str) -> None:
        row = {
            "user_id": user_id,
            "provider": provider,
            "model": model,
            "api_key_encrypted": encrypt_secret(api_key),
            "connected_at": datetime.now(timezone.utc).isoformat(),
        }
        supabase.table(TABLE_NAME).upsert(row, on_conflict="user_id").execute()

    def get_credentials(self, user_id: str) -> AiProviderCredentials | None:
        row = self._get_row(user_id)
        if not row:
            return None
        return AiProviderCredentials(
            provider=row["provider"],
            model=row["model"],
            api_key=decrypt_secret(row["api_key_encrypted"]),
        )

    def get_status(self, user_id: str) -> dict:
        row = self._get_row(user_id)
        if not row:
            return {"configured": False, "provider": None, "model": None}
        return {"configured": True, "provider": row["provider"], "model": row["model"]}

    def delete(self, user_id: str) -> None:
        supabase.table(TABLE_NAME).delete().eq("user_id", user_id).execute()

    def _get_row(self, user_id: str) -> dict | None:
        result = supabase.table(TABLE_NAME).select("*").eq("user_id", user_id).execute()
        return result.data[0] if result.data else None


ai_provider_key_store = AiProviderKeyStore()
