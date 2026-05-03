import os
import logging
from typing import Annotated
from urllib.parse import urlparse

import httpx
from fastapi import Header, HTTPException
from jose import jwt, JWTError

from core.config import settings

logger = logging.getLogger(__name__)

JWKS: dict | None = None


async def get_jwks() -> dict:
    global JWKS
    if JWKS is None:
        jwks_url = settings.SUPABASE_JWKS_URL
        if not jwks_url:
            raise HTTPException(500, "SUPABASE_JWKS_URL not configured")
        async with httpx.AsyncClient() as client:
            response = await client.get(jwks_url)
            JWKS = response.json()
    return JWKS


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    if not authorization:
        logger.warning("Missing authorization header")
        raise HTTPException(401, "Missing authorization header")

    if not authorization.startswith("Bearer "):
        logger.warning(f"Invalid authorization format: {authorization[:20]}...")
        raise HTTPException(401, "Invalid authorization format")

    token = authorization[7:]
    logger.info(f"Received token (length: {len(token)})")

    # Decode without verification to inspect payload FIRST
    try:
        unverified_payload = jwt.get_unverified_claims(token)
        token_aud = unverified_payload.get("aud")
        token_iss = unverified_payload.get("iss")
        logger.info(f"Token payload - aud: {token_aud}, iss: {token_iss}")
    except Exception as e:
        logger.error(f"Failed to decode unverified payload: {e}")
        raise HTTPException(401, f"Invalid token format: {e}")

    jwks = await get_jwks()
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")
    alg = unverified_header.get("alg")
    logger.info(f"Token header - kid: {kid}, alg: {alg}")

    key = None
    for k in jwks.get("keys", []):
        if k.get("kid") == kid:
            key = k
            logger.info(f"Found matching key for kid: {kid}")
            break

    if not key:
        logger.error(
            f"No matching key found for kid: {kid}. Available kids: {[k.get('kid') for k in jwks.get('keys', [])]}"
        )
        raise HTTPException(401, "Invalid token")

    # Calculate expected issuer
    # JWKS URL: https://...supabase.co/auth/v1/.well-known/jwks.json
    # Issuer: https://...supabase.co/auth/v1
    issuer = ""
    if settings.SUPABASE_JWKS_URL:
        issuer = settings.SUPABASE_JWKS_URL.replace("/.well-known/jwks.json", "")

    audience = settings.SUPABASE_AUDIENCE or "authenticated"

    logger.info(
        f"Validation params - expected aud: {audience}, expected iss: {issuer}, token aud: {token_aud}, token iss: {token_iss}"
    )

    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=["ES256"],
            audience=audience,
            issuer=issuer,
        )
        logger.info(f"Token validated successfully for user: {payload.get('sub')}")
    except JWTError as e:
        logger.error(f"JWT validation failed: {e}")
        logger.error(f"Mismatch details - expected aud: {audience}, got: {token_aud}")
        logger.error(f"Mismatch details - expected iss: {issuer}, got: {token_iss}")
        raise HTTPException(401, f"Invalid token: {e}")

    return payload.get("sub")
