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
