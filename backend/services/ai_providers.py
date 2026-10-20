"""Call a user-chosen AI provider with the user's own API key.

Keys arrive as arguments, are sent only in request headers, and are never logged.
Every provider is asked for a JSON object and returns its raw text; parsing
lives in compose_service.
"""

import logging
import re

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
OPENAI_MODELS_URL = "https://api.openai.com/v1/models"
ANTHROPIC_MODELS_URL = "https://api.anthropic.com/v1/models"
# Deprecated models stay callable but are closed to new adopters.
ANTHROPIC_ACTIVE_LIFECYCLE = "active"
MODEL_LIST_PAGE_SIZE = 1000
MAX_RECENT_MODELS = 8
GEMINI_GENERATE_METHOD = "generateContent"
GEMINI_MODEL_NAME_PREFIX = "models/"
GEMINI_VERSIONED_ID_PATTERN = re.compile(r"^gemini-(\d+(?:\.\d+)?)-")
GEMINI_LATEST_ALIAS_SUFFIX = "-latest"
# Per Gemini's naming docs: "preview" and "exp" ids are not production-stable.
GEMINI_UNSTABLE_MARKERS = ("preview", "exp")
# Gemini and OpenAI lists mix in audio, image, embedding and agent models.
GEMINI_NON_TEXT_MARKERS = (
    "tts", "image", "transcribe", "live", "embedding", "omni", "robotics",
    "computer-use", "customtools", "audio",
)
OPENAI_NON_TEXT_MARKERS = (
    "embedding", "whisper", "tts", "transcribe", "image", "moderation",
    "realtime", "audio", "dall-e", "davinci", "babbage", "search", "sora", "ft:",
)
REQUEST_TIMEOUT_IN_SECONDS = 30

STATUS_RATE_LIMITED = 429
STATUSES_KEY_REJECTED = (401, 403)
GEMINI_INVALID_KEY_MARKER = "API key not valid"

KEY_REJECTED_MESSAGE = "Your AI provider rejected the key. Check it in Settings."
RATE_LIMITED_MESSAGE = "Your AI provider is rate limiting this key. Try again shortly."
PROVIDER_FAILED_MESSAGE = "Could not reach your AI provider. Try again."
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


def list_models(provider: str, api_key: str) -> list[str]:
    """The newest text-generation model ids the key can use, newest first."""
    if provider == PROVIDER_GEMINI:
        return _list_gemini_models(api_key)
    if provider == PROVIDER_ANTHROPIC:
        return _list_anthropic_models(api_key)
    if provider == PROVIDER_OPENAI:
        return _list_openai_models(api_key)
    raise HTTPException(400, "Unknown AI provider")


def _list_gemini_models(api_key: str) -> list[str]:
    reply = _get_json(
        PROVIDER_GEMINI,
        f"{GEMINI_BASE_URL}/models",
        {"x-goog-api-key": api_key},
        {"pageSize": MODEL_LIST_PAGE_SIZE},
    )
    generate_model_ids = [
        model["name"].removeprefix(GEMINI_MODEL_NAME_PREFIX)
        for model in reply.get("models", [])
        if GEMINI_GENERATE_METHOD in model.get("supportedGenerationMethods", [])
    ]
    text_model_ids = [
        model_id
        for model_id in generate_model_ids
        if not any(marker in model_id for marker in GEMINI_NON_TEXT_MARKERS)
    ]
    # "-latest" aliases always track the newest release. Gemini returns no release
    # date, so stable ids are ranked by the version number in the id.
    latest_aliases = sorted(
        model_id
        for model_id in text_model_ids
        if model_id.startswith("gemini-") and model_id.endswith(GEMINI_LATEST_ALIAS_SUFFIX)
    )
    stable_models = [
        model_id
        for model_id in text_model_ids
        if GEMINI_VERSIONED_ID_PATTERN.match(model_id)
        and not any(marker in model_id for marker in GEMINI_UNSTABLE_MARKERS)
    ]
    stable_newest_first = sorted(stable_models, key=_gemini_version_sort_key, reverse=True)
    return (latest_aliases + stable_newest_first)[:MAX_RECENT_MODELS]


def _gemini_version_sort_key(model_id: str) -> tuple[float, str]:
    version = float(GEMINI_VERSIONED_ID_PATTERN.match(model_id).group(1))
    return (version, model_id)


def _list_anthropic_models(api_key: str) -> list[str]:
    reply = _get_json(
        PROVIDER_ANTHROPIC,
        ANTHROPIC_MODELS_URL,
        {"x-api-key": api_key, "anthropic-version": ANTHROPIC_VERSION},
        {"limit": MODEL_LIST_PAGE_SIZE},
    )
    active_models = [
        model
        for model in reply.get("data", [])
        if model.get("lifecycle", ANTHROPIC_ACTIVE_LIFECYCLE) == ANTHROPIC_ACTIVE_LIFECYCLE
    ]
    newest_first = sorted(active_models, key=lambda model: model.get("created_at", ""), reverse=True)
    return [model["id"] for model in newest_first][:MAX_RECENT_MODELS]


def _list_openai_models(api_key: str) -> list[str]:
    reply = _get_json(PROVIDER_OPENAI, OPENAI_MODELS_URL, {"Authorization": f"Bearer {api_key}"})
    text_models = [
        model
        for model in reply.get("data", [])
        if not model.get("shutdown_date") and not _is_openai_non_text_model(model["id"])
    ]
    newest_first = sorted(text_models, key=lambda model: model.get("created", 0), reverse=True)
    return [model["id"] for model in newest_first][:MAX_RECENT_MODELS]


def _is_openai_non_text_model(model_id: str) -> bool:
    return any(marker in model_id for marker in OPENAI_NON_TEXT_MARKERS)


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
    return _send(
        provider,
        lambda: httpx.post(
            url,
            headers={"Content-Type": "application/json", **auth_headers},
            json=body,
            timeout=REQUEST_TIMEOUT_IN_SECONDS,
        ),
    )


def _get_json(provider: str, url: str, auth_headers: dict[str, str], params: dict | None = None) -> dict:
    return _send(
        provider,
        lambda: httpx.get(url, headers=auth_headers, params=params, timeout=REQUEST_TIMEOUT_IN_SECONDS),
    )


def _send(provider: str, send_request) -> dict:
    try:
        response = send_request()
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as error:
        raise _http_error_for_status(provider, error.response)
    except Exception as error:
        logger.error(f"{provider} call failed: {type(error).__name__}")
        raise HTTPException(502, PROVIDER_FAILED_MESSAGE)


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
    return HTTPException(502, PROVIDER_FAILED_MESSAGE)


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
