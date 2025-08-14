# app/utils/security.py
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt
from fastapi import HTTPException, status
from passlib.context import CryptContext

from app.core.config import settings
from app.core.logger import logger

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# -------------------------
# Password helpers
# -------------------------
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# -------------------------
# Token payload builders
# -------------------------
def build_token_payload(
    *,
    user_id: str,
    username: str,
    role: Optional[str] = None,
    company_id: Optional[str] = None,
    company_slug: Optional[str] = None,
    db_name: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Canonical payload to include in BOTH access and refresh tokens.
    - Includes identity claims (sub, username, role)
    - Includes tenant claims (company_id, company_slug, db_name)
    - Allows extra custom fields via `extra`
    """
    payload: Dict[str, Any] = {
        "sub": user_id,
        "username": username,
        "role": role,
        # tenant/DB routing claims (used by deps.get_tenant_session)
        "company_id": company_id,
        "company_slug": company_slug,
        "db_name": db_name,
        # issued-at
        "iat": datetime.now(timezone.utc),
    }
    if extra:
        payload.update(extra)
    # Drop Nones to keep tokens tidy
    return {k: v for k, v in payload.items() if v is not None}


# -------------------------
# JWT encode/decode
# -------------------------
def create_access_token(data: dict, expires_minutes: Optional[int] = None) -> str:
    """
    Encodes an access token.
    `data` should already contain identity + tenant claims (see build_token_payload).
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": to_encode.get("iat", now)})
    token = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    logger.debug("🔐 Access token created")
    return token


def create_refresh_token(data: dict, expires_days: Optional[int] = None) -> str:
    """
    Encodes a refresh token. We mirror the same claims as access (minus scopes),
    so the refresh can recreate a new access token with the same tenant context.
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=expires_days or settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "iat": to_encode.get("iat", now)})
    token = jwt.encode(to_encode, settings.REFRESH_SECRET, algorithm=settings.JWT_ALGORITHM)
    logger.debug("🔐 Refresh token created")
    return token


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        logger.debug("🔎 Access token decoded")
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("⚠️ Access token expired")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token expired")
    except jwt.PyJWTError:
        logger.warning("⚠️ Invalid access token")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")


def decode_refresh_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.REFRESH_SECRET, algorithms=[settings.JWT_ALGORITHM])
        logger.debug("🔎 Refresh token decoded")
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("⚠️ Refresh token expired")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")
    except jwt.PyJWTError:
        logger.warning("⚠️ Invalid refresh token")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")


# -------------------------
# Master credentials helpers
# -------------------------
def is_master_credentials(username: str, password: str) -> bool:
    return username == settings.MASTER_USERNAME and password == settings.MASTER_PASSWORD


def is_master_username(username: str) -> bool:
    return username == settings.MASTER_USERNAME
