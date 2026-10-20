"""Provider adapters: key placement, request shape, and error mapping (no network)."""

import httpx
import pytest
from fastapi import HTTPException

import services.ai_providers as providers

API_KEY = "secret-key-123"


class FakeResponse:
    def __init__(self, status_code=200, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("boom", request=None, response=self)

    def json(self):
        return self._payload


@pytest.fixture
def reply_with(monkeypatch):
    """Install a fake httpx.post that returns the payload; returns the recorded calls."""

    def install(payload):
        calls = []

        def fake_post(url, **kwargs):
            calls.append({"url": url, **kwargs})
            return FakeResponse(payload=payload)

        monkeypatch.setattr(httpx, "post", fake_post)
        return calls

    return install


def _request(provider, model="m"):
    return providers.request_json_text(provider, API_KEY, model, "system", "hello", {"type": "object"})


def test_gemini_sends_key_in_header_not_url(reply_with):
    calls = reply_with({"candidates": [{"content": {"parts": [{"text": "{}"}]}}]})

    assert _request("gemini", "gemini-x") == "{}"

    call = calls[0]
    assert API_KEY not in call["url"]
    assert "params" not in call
    assert call["headers"]["x-goog-api-key"] == API_KEY
    assert call["url"].endswith("/models/gemini-x:generateContent")


def test_anthropic_request_shape(reply_with):
    calls = reply_with({"content": [{"type": "text", "text": "{}"}]})

    assert _request("anthropic", "claude-x") == "{}"

    call = calls[0]
    assert call["url"] == providers.ANTHROPIC_MESSAGES_URL
    assert call["headers"]["x-api-key"] == API_KEY
    assert call["headers"]["anthropic-version"] == providers.ANTHROPIC_VERSION
    assert call["json"]["system"] == "system"
    assert call["json"]["model"] == "claude-x"


def test_openai_request_shape(reply_with):
    calls = reply_with({"choices": [{"message": {"content": "{}"}}]})

    assert _request("openai", "gpt-x") == "{}"

    call = calls[0]
    assert call["url"] == providers.OPENAI_CHAT_COMPLETIONS_URL
    assert call["headers"]["Authorization"] == f"Bearer {API_KEY}"
    assert call["json"]["response_format"] == {"type": "json_object"}


def test_unknown_provider_is_rejected():
    with pytest.raises(HTTPException) as error:
        _request("nope")

    assert error.value.status_code == 400


@pytest.mark.parametrize("status_code", [401, 403])
def test_rejected_key_maps_to_400(monkeypatch, status_code):
    monkeypatch.setattr(httpx, "post", lambda url, **kwargs: FakeResponse(status_code))

    with pytest.raises(HTTPException) as error:
        _request("openai")

    assert error.value.status_code == 400
    assert API_KEY not in str(error.value.detail)


def test_gemini_invalid_key_400_maps_to_rejected(monkeypatch):
    monkeypatch.setattr(
        httpx, "post", lambda url, **kwargs: FakeResponse(400, text="API key not valid. Please pass")
    )

    with pytest.raises(HTTPException) as error:
        _request("gemini")

    assert error.value.detail == providers.KEY_REJECTED_MESSAGE


def test_rate_limit_maps_to_429(monkeypatch):
    monkeypatch.setattr(httpx, "post", lambda url, **kwargs: FakeResponse(429))

    with pytest.raises(HTTPException) as error:
        _request("anthropic")

    assert error.value.status_code == 429


def test_network_failure_does_not_leak_key(monkeypatch, caplog):
    def fail(url, **kwargs):
        raise httpx.ConnectError(f"cannot reach host with {API_KEY}")

    monkeypatch.setattr(httpx, "post", fail)

    with pytest.raises(HTTPException) as error:
        _request("openai")

    assert error.value.status_code == 502
    assert API_KEY not in caplog.text


def test_anthropic_skips_leading_thinking_block(reply_with):
    reply_with(
        {
            "stop_reason": "end_turn",
            "content": [
                {"type": "thinking", "thinking": "", "signature": "sig"},
                {"type": "text", "text": '{"title": "T"}'},
            ],
        }
    )

    assert _request("anthropic") == '{"title": "T"}'


@pytest.mark.parametrize(
    "stop_reason, message",
    [("refusal", providers.REFUSED_MESSAGE), ("max_tokens", providers.CUT_OFF_MESSAGE)],
)
def test_anthropic_incomplete_replies_get_a_clear_error(reply_with, stop_reason, message):
    reply_with({"stop_reason": stop_reason, "content": [{"type": "text", "text": "{"}]})

    with pytest.raises(HTTPException) as error:
        _request("anthropic")

    assert error.value.detail == message


def test_anthropic_without_text_block_is_unreadable(reply_with):
    reply_with({"stop_reason": "end_turn", "content": [{"type": "thinking", "thinking": ""}]})

    with pytest.raises(HTTPException) as error:
        _request("anthropic")

    assert error.value.status_code == 502


def test_openai_refusal_gets_a_clear_error(reply_with):
    reply_with(
        {"choices": [{"finish_reason": "stop", "message": {"content": None, "refusal": "I can't help"}}]}
    )

    with pytest.raises(HTTPException) as error:
        _request("openai")

    assert error.value.detail == providers.REFUSED_MESSAGE


def test_openai_truncated_reply_gets_a_clear_error(reply_with):
    reply_with({"choices": [{"finish_reason": "length", "message": {"content": "{"}}]})

    with pytest.raises(HTTPException) as error:
        _request("openai")

    assert error.value.detail == providers.CUT_OFF_MESSAGE


@pytest.mark.parametrize(
    "payload",
    [{}, {"choices": []}, {"choices": [{"finish_reason": "stop", "message": {"content": None}}]}],
)
def test_openai_empty_reply_is_unreadable(reply_with, payload):
    reply_with(payload)

    with pytest.raises(HTTPException) as error:
        _request("openai")

    assert error.value.detail == providers.UNREADABLE_MESSAGE


def test_openai_json_mode_request_mentions_json_in_the_system_prompt(reply_with):
    from services.compose_service import SYSTEM_PROMPT

    calls = reply_with({"choices": [{"finish_reason": "stop", "message": {"content": "{}"}}]})

    providers.request_json_text("openai", API_KEY, "gpt-6-luna", SYSTEM_PROMPT, "hi", {})

    # OpenAI rejects json_object mode when the word JSON is absent from the messages.
    assert "JSON" in calls[0]["json"]["messages"][0]["content"]


@pytest.fixture
def list_reply_with(monkeypatch):
    """Install a fake httpx.get that returns the payload; returns the recorded calls."""

    def install(payload):
        calls = []

        def fake_get(url, **kwargs):
            calls.append({"url": url, **kwargs})
            return FakeResponse(payload=payload)

        monkeypatch.setattr(httpx, "get", fake_get)
        return calls

    return install


def _gemini_model(name, methods=("generateContent",)):
    return {"name": f"models/{name}", "supportedGenerationMethods": list(methods)}


def test_gemini_lists_latest_aliases_then_stable_models_newest_first(list_reply_with):
    calls = list_reply_with(
        {
            "models": [
                _gemini_model("gemini-2.5-flash"),
                _gemini_model("gemini-3.8-flash"),
                _gemini_model("gemini-flash-latest"),
                _gemini_model("gemini-pro-latest"),
                _gemini_model("gemini-3.1-pro-preview"),
                _gemini_model("gemini-3.9-flash-exp"),
                _gemini_model("gemini-3.8-flash-tts"),
                _gemini_model("gemini-3.1-flash-image"),
                _gemini_model("gemini-2.5-embedding", methods=("embedContent",)),
                _gemini_model("deep-research-pro-preview-12-2025"),
                _gemini_model("gemma-4-31b-it"),
            ]
        }
    )

    assert providers.list_models("gemini", API_KEY) == [
        "gemini-flash-latest",
        "gemini-pro-latest",
        "gemini-3.8-flash",
        "gemini-2.5-flash",
    ]
    assert calls[0]["headers"]["x-goog-api-key"] == API_KEY
    assert API_KEY not in calls[0]["url"]


def test_gemini_caps_the_list_at_the_recent_limit(list_reply_with):
    list_reply_with({"models": [_gemini_model(f"gemini-{major}.0-flash") for major in range(1, 20)]})

    models = providers.list_models("gemini", API_KEY)

    assert len(models) == providers.MAX_RECENT_MODELS
    assert models[0] == "gemini-19.0-flash"


def test_anthropic_lists_active_models_newest_first(list_reply_with):
    calls = list_reply_with(
        {
            "data": [
                {"id": "claude-old", "created_at": "2025-01-01T00:00:00Z", "lifecycle": "active"},
                {"id": "claude-new", "created_at": "2026-09-21T00:00:00Z", "lifecycle": "active"},
                {"id": "claude-mid", "created_at": "2025-11-01T00:00:00Z"},
                {"id": "claude-deprecated", "created_at": "2026-10-01T00:00:00Z", "lifecycle": "deprecated"},
            ],
            "has_more": False,
        }
    )

    assert providers.list_models("anthropic", API_KEY) == ["claude-new", "claude-mid", "claude-old"]
    assert calls[0]["headers"]["x-api-key"] == API_KEY
    assert calls[0]["params"] == {"limit": providers.MODEL_LIST_PAGE_SIZE}


def test_openai_lists_newest_text_models_and_drops_the_rest(list_reply_with):
    list_reply_with(
        {
            "data": [
                {"id": "gpt-old", "created": 100},
                {"id": "gpt-6-luna", "created": 300},
                {"id": "text-embedding-3-small", "created": 400},
                {"id": "whisper-1", "created": 500},
                {"id": "gpt-image-2", "created": 600},
                {"id": "ft:gpt-6:acme:custom", "created": 700},
                {"id": "gpt-shutdown", "created": 800, "shutdown_date": "2026-10-23"},
                {"id": "gpt-6.1-sol", "created": 200, "shutdown_date": None},
            ]
        }
    )

    assert providers.list_models("openai", API_KEY) == ["gpt-6-luna", "gpt-6.1-sol", "gpt-old"]


def test_openai_caps_the_list_at_the_recent_limit(list_reply_with):
    list_reply_with({"data": [{"id": f"gpt-{index}", "created": index} for index in range(30)]})

    models = providers.list_models("openai", API_KEY)

    assert len(models) == providers.MAX_RECENT_MODELS
    assert models[0] == "gpt-29"


def test_list_models_rejected_key_maps_to_400(monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda url, **kwargs: FakeResponse(401))

    with pytest.raises(HTTPException) as error:
        providers.list_models("openai", API_KEY)

    assert error.value.detail == providers.KEY_REJECTED_MESSAGE
