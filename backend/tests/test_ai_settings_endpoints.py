"""AI settings endpoints: auth, validation, and that the key is never echoed."""

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from main import app, get_current_user
import main

client = TestClient(app)
API_KEY = "sk-super-secret-value"


@pytest.fixture(autouse=True)
def signed_in_user(monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: "user-1"
    saved = {}

    monkeypatch.setattr(main, "list_models", lambda provider, api_key: ["gpt-6-luna"])
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


def test_models_verifies_the_typed_key_and_returns_the_list(monkeypatch):
    seen = {}
    monkeypatch.setattr(
        main, "list_models", lambda provider, api_key: seen.update(provider=provider, api_key=api_key) or ["m1"]
    )

    response = client.post("/api/ai/models", json={"provider": "openai", "api_key": API_KEY})

    assert response.json() == {"models": ["m1"]}
    assert seen == {"provider": "openai", "api_key": API_KEY}


def test_models_requires_a_key():
    assert client.post("/api/ai/models", json={"provider": "gemini"}).status_code == 422


def test_models_surfaces_a_rejected_key(monkeypatch):
    def reject(provider, api_key):
        raise HTTPException(400, "Your AI provider rejected the key. Check it in Settings.")

    monkeypatch.setattr(main, "list_models", reject)

    response = client.post("/api/ai/models", json={"provider": "openai", "api_key": API_KEY})

    assert response.status_code == 400


def test_save_does_not_store_a_key_the_provider_rejects(monkeypatch, signed_in_user):
    def reject(provider, api_key):
        raise HTTPException(400, "Your AI provider rejected the key. Check it in Settings.")

    monkeypatch.setattr(main, "list_models", reject)

    response = client.put(
        "/api/ai/settings", json={"provider": "openai", "model": "gpt-6-luna", "api_key": API_KEY}
    )

    assert response.status_code == 400
    assert signed_in_user == {}
