# app/validators/auth_validator.py
from fastapi import HTTPException, status
from app.core.logger import logger
from app.utils.security import verify_password

def ensure_unique_username(db, username: str, auth_repo) -> None:
    if auth_repo.get_user_by_username(db, username):
        logger.warning(f"🛑 Attempt to register with existing username: {username}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")

def validate_credentials(user, plain_password: str) -> None:
    if not user or not verify_password(plain_password, user.hashed_password):
        logger.warning("❌ Invalid credentials")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

def require_refresh_cookie(token_str: str) -> None:
    if not token_str:
        logger.warning("⚠️ No refresh token in cookies")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")
