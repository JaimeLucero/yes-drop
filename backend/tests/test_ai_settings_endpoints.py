"""AI settings endpoints: auth, validation, and that the key is never echoed."""

import pytest
from fastapi.testclient import TestClient

from main import app, get_current_user
import main

client = TestClient(app)
API_KEY = "sk-super-secret-value"


@pytest.fixture(autouse=True)
def signed_in_user(monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: "user-1"
    saved = {}

    monkeypatch.setattr(
        main.ai_provider_key_store, "save", lambda user_id, provider, model, api_key: saved.update(
            provider=provider, model=model, api_key=api_key
        )
    )
    monkeypatch.setattr(
        main.ai_provider_key_store,
        "get_status",
        lambda user_id: {"configured": True, "provider": saved["provider"], "model": saved["model"]},
    )
    yield saved
    app.dependency_overrides.clear()


def test_save_never_echoes_the_key(signed_in_user):
    response = client.put(
        "/api/ai/settings", json={"provider": "openai", "model": "gpt-6-luna", "api_key": API_KEY}
    )

    assert response.status_code == 200
    assert API_KEY not in response.text
    assert signed_in_user["api_key"] == API_KEY


@pytest.mark.parametrize(
    "payload",
    [
        {"provider": "bogus", "model": "m", "api_key": API_KEY},
        {"provider": "gemini", "model": "../../evil", "api_key": API_KEY},
        {"provider": "gemini", "model": "m", "api_key": "short"},
    ],
)
def test_invalid_settings_are_rejected(payload):
    assert client.put("/api/ai/settings", json=payload).status_code == 422


def test_compose_without_key_is_400(monkeypatch):
    monkeypatch.setattr(main.ai_provider_key_store, "get_credentials", lambda user_id: None)

    response = client.post("/api/compose", json={"prompt": "ask jane to approve"})

    assert response.status_code == 400
