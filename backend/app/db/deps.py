# app/db/deps.py
from typing import Dict, Generator, Optional

import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.logger import logger
from app.db.database import ensure_tenant_tables, get_tenant_session

ALGORITHM = settings.JWT_ALGORITHM
SECRET_KEY = settings.JWT_SECRET


def _get_bearer_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    return auth_header.split(" ", 1)[1]


def get_token_claims(request: Request) -> Dict:
    """Decode the access token and return raw claims."""
    token = _get_bearer_token(request)
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_current_user(claims: Dict = Depends(get_token_claims)) -> Dict:
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return {
        "id": claims.get("id") or sub,
        "username": claims.get("username") or sub,
        "email": claims.get("email"),
        "role": claims.get("role"),
        "db": claims.get("db") or claims.get("db_name"),
        "company_id": claims.get("company_id"),
    }


def require_super_admin(user: Dict = Depends(get_current_user)) -> Dict:
    role = user.get("role")
    if role not in ("super_admin", "master"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return user


def get_company_db(request: Request, claims: Dict = Depends(get_token_claims)) -> Generator[Session, None, None]:
    """
    Open a tenant-scoped DB session using db_name from JWT claims.
    Super admins may pass X-Tenant-DB header to view another tenant's data.
    Ensures tenant tables exist (best-effort, idempotent).
    """
    role: Optional[str] = claims.get("role")
    override_db = request.headers.get("X-Tenant-DB")
    if override_db and role in ("super_admin", "master"):
        db_name: Optional[str] = override_db
        logger.info(f"🔍 Super admin viewing tenant DB: {db_name}")
    else:
        db_name = claims.get("db") or claims.get("db_name")
    if not db_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No tenant database in token")

    # Best-effort bootstrap: don't crash request on hiccups
    try:
        ensure_tenant_tables(db_name)
    except Exception as e:
        logger.warning(f"⚠️ ensure_tenant_tables warning for '{db_name}': {repr(e)}")

    SessionLocal = get_tenant_session(db_name)
    logger.info(f"🏷️  Tenant DB selected: {db_name}")

    db = SessionLocal()
    try:
        yield db
    except (HTTPException, StarletteHTTPException):
        raise  # let FastAPI handle 4xx responses from route handlers normally
    except Exception:
        logger.exception(f"❌ Tenant DB error [{db_name}]")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="DB Connection failed")
    finally:
        db.close()
