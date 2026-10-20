"""Fernet encryption for secrets stored in the database (OAuth refresh tokens, AI provider keys)."""

from cryptography.fernet import Fernet

from core.config import settings


def _fernet() -> Fernet:
    if not settings.TOKEN_ENC_KEY:
        raise RuntimeError("TOKEN_ENC_KEY not configured")
    return Fernet(settings.TOKEN_ENC_KEY.encode())


def encrypt_secret(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    return _fernet().decrypt(ciphertext.encode()).decode()
