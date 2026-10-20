"""Call a user-chosen AI provider with the user's own API key.

Keys arrive as arguments, are sent only in request headers, and are never logged.
Every provider is asked for a JSON object and returns its raw text; parsing
lives in compose_service.
"""

import logging

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

PROVIDER_GEMINI = "gemini"
PROVIDER_ANTHROPIC = "anthropic"
PROVIDER_OPENAI = "openai"

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
# Claude may think before answering and thinking tokens count toward this cap.
ANTHROPIC_MAX_OUTPUT_TOKENS = 4096
OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"
REQUEST_TIMEOUT_IN_SECONDS = 30

STATUS_RATE_LIMITED = 429
STATUSES_KEY_REJECTED = (401, 403)
GEMINI_INVALID_KEY_MARKER = "API key not valid"

KEY_REJECTED_MESSAGE = "Your AI provider rejected the key. Check it in Settings."
RATE_LIMITED_MESSAGE = "Your AI provider is rate limiting this key. Try again shortly."
COMPOSE_FAILED_MESSAGE = "Could not compose the automation. Try again."
REFUSED_MESSAGE = "The AI declined this request. Try rewording it."
CUT_OFF_MESSAGE = "The AI response was cut off. Try a shorter request."
UNREADABLE_MESSAGE = "AI returned an unreadable draft"
FINISH_REASON_LENGTH = "length"
STOP_REASON_REFUSAL = "refusal"
STOP_REASON_MAX_TOKENS = "max_tokens"


def request_json_text(
    provider: str, api_key: str, model: str, system_prompt: str, prompt: str, response_schema: dict
) -> str:
    """Ask the provider for a JSON object and return its raw text reply."""
    if provider == PROVIDER_GEMINI:
        return _call_gemini(api_key, model, system_prompt, prompt, response_schema)
    if provider == PROVIDER_ANTHROPIC:
        return _call_anthropic(api_key, model, system_prompt, prompt)
    if provider == PROVIDER_OPENAI:
        return _call_openai(api_key, model, system_prompt, prompt)
    raise HTTPException(400, "Unknown AI provider")


def _call_gemini(api_key: str, model: str, system_prompt: str, prompt: str, response_schema: dict) -> str:
    body = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": response_schema,
        },
    }
    reply = _post_json(
        PROVIDER_GEMINI,
        f"{GEMINI_BASE_URL}/models/{model}:generateContent",
        {"x-goog-api-key": api_key},
        body,
    )
    return _read_reply(lambda: reply["candidates"][0]["content"]["parts"][0]["text"])


def _call_anthropic(api_key: str, model: str, system_prompt: str, prompt: str) -> str:
    body = {
        "model": model,
        "max_tokens": ANTHROPIC_MAX_OUTPUT_TOKENS,
        "system": system_prompt,
        "messages": [{"role": "user", "content": prompt}],
    }
    reply = _post_json(
        PROVIDER_ANTHROPIC,
        ANTHROPIC_MESSAGES_URL,
        {"x-api-key": api_key, "anthropic-version": ANTHROPIC_VERSION},
        body,
    )
    return _read_anthropic_text(reply)


def _call_openai(api_key: str, model: str, system_prompt: str, prompt: str) -> str:
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
    }
    reply = _post_json(
        PROVIDER_OPENAI,
        OPENAI_CHAT_COMPLETIONS_URL,
        {"Authorization": f"Bearer {api_key}"},
        body,
    )
    return _read_openai_text(reply)


def _post_json(provider: str, url: str, auth_headers: dict[str, str], body: dict) -> dict:
    try:
        response = httpx.post(
            url,
            headers={"Content-Type": "application/json", **auth_headers},
            json=body,
            timeout=REQUEST_TIMEOUT_IN_SECONDS,
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as error:
        raise _http_error_for_status(provider, error.response)
    except Exception as error:
        logger.error(f"{provider} call failed: {type(error).__name__}")
        raise HTTPException(502, COMPOSE_FAILED_MESSAGE)


def _http_error_for_status(provider: str, response: httpx.Response) -> HTTPException:
    status_code = response.status_code
    is_key_rejected = status_code in STATUSES_KEY_REJECTED or (
        provider == PROVIDER_GEMINI and GEMINI_INVALID_KEY_MARKER in response.text
    )
    if is_key_rejected:
        return HTTPException(400, KEY_REJECTED_MESSAGE)
    if status_code == STATUS_RATE_LIMITED:
        logger.warning(f"{provider} rate limited this key")
        return HTTPException(
            STATUS_RATE_LIMITED, detail={"message": RATE_LIMITED_MESSAGE, "scope": "provider"}
        )
    logger.error(f"{provider} call failed with status {status_code}")
    return HTTPException(502, COMPOSE_FAILED_MESSAGE)


def _read_openai_text(reply: dict) -> str:
    """Return the message content, mapping refusals and truncation to clear errors."""
    try:
        choice = reply["choices"][0]
    except (KeyError, IndexError, TypeError):
        raise HTTPException(502, UNREADABLE_MESSAGE)
    message = choice.get("message") or {}
    if message.get("refusal"):
        raise HTTPException(502, REFUSED_MESSAGE)
    if choice.get("finish_reason") == FINISH_REASON_LENGTH:
        raise HTTPException(502, CUT_OFF_MESSAGE)
    content = message.get("content")
    if not content:
        raise HTTPException(502, UNREADABLE_MESSAGE)
    return content


def _read_anthropic_text(reply: dict) -> str:
    """Return the first text block; thinking blocks can precede it."""
    stop_reason = reply.get("stop_reason")
    if stop_reason == STOP_REASON_REFUSAL:
        raise HTTPException(502, REFUSED_MESSAGE)
    if stop_reason == STOP_REASON_MAX_TOKENS:
        raise HTTPException(502, CUT_OFF_MESSAGE)
    return _read_reply(
        lambda: next(block["text"] for block in reply["content"] if block.get("type") == "text")
    )


def _read_reply(read_text) -> str:
    try:
        return read_text()
    except (KeyError, IndexError, TypeError, StopIteration):
        raise HTTPException(502, UNREADABLE_MESSAGE)
