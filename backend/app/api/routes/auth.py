# app/api/routes/auth.py
import time
import secrets
import smtplib
from email.mime.text import MIMEText
from fastapi import APIRouter, Depends, Response, Request, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.core.config import settings
from app.db.database import get_db
from app.db.deps import get_current_user  # <-- make sure this returns claims from JWT
from app.schemas.auth import UserCreate, UserRead, LoginInput, LoginResponse, SetPasswordInput, UserUpdate
from app.services.auth_service import AuthService
from app.repositories.auth_repo import AuthRepository
from app.repositories.company_profile_repo import CompanyProfileRepository
from app.utils.response_utils import set_refresh_cookie
from app.utils.security import hash_password

# In-memory reset token store: {token: {user_id, expires_at}}
_reset_tokens: dict = {}
_TOKEN_TTL = 3600  # 1 hour

router = APIRouter()
service = AuthService()
auth_repo = AuthRepository()
company_repo = CompanyProfileRepository()

@router.post("/register", response_model=UserRead)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    logger.info(f"➡️ POST /auth/register | user={user.username}")
    result = service.register_user(user, db)
    logger.info(f"✅ User registered: {result.username}")
    return result

@router.post("/login", response_model=LoginResponse)
def login(payload: LoginInput, response: Response, db: Session = Depends(get_db)):
    logger.info(f"➡️ POST /auth/login | user={payload.username}")
    result, refresh_token = service.login(payload, db)
    set_refresh_cookie(response, refresh_token)
    logger.info(f"✅ User login successful: {payload.username}")
    return result

@router.post("/refresh", response_model=LoginResponse)
def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    logger.info("➡️ POST /auth/refresh")
    token = request.cookies.get("refresh_token")
    result, new_refresh = service.refresh(token, db)
    set_refresh_cookie(response, new_refresh)
    logger.info("🔁 Token refreshed")
    return result

@router.post("/set-password", response_model=UserRead)
def set_password(
    payload: SetPasswordInput,
    claims: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """First-time / forced password reset. Clears must_change_password flag."""
    logger.info(f"➡️ POST /auth/set-password | user={claims.get('username')}")
    user_id = int(claims.get("id") or claims.get("sub"))
    result = service.set_password(user_id, payload, db)
    logger.info(f"✅ Password set for user: {result.username}")
    return result


@router.get("/me")
def me(claims: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns current user + company context based on the access token."""
    username = claims.get("username") or claims.get("sub")
    db_name = claims.get("db_name") or claims.get("db")

    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    # Master login is a hardcoded credential, not a row in the users table —
    # build its identity straight from the token claims, same as the login endpoint.
    if claims.get("role") == "master":
        return {
            "user": {
                "id": 0,
                "username": "master",
                "email": claims.get("email", settings.MASTER_EMAIL),
                "role": "master",
                "must_change_password": False,
            },
            "company": {
                "db_name": db_name,
                "company_name": "Master",
            },
        }

    user = auth_repo.get_user_by_username(db, username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    company = company_repo.get_by_id(db, user.company_id) if getattr(user, "company_id", None) else None

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": getattr(user, "role", "tenant_admin"),
            "must_change_password": bool(getattr(user, "must_change_password", False)),
        },
        "company": {
            "db_name": getattr(company, "db_name", db_name),
            "company_name": getattr(company, "company_name", None),
        },
    }


class ForgotPasswordInput(BaseModel):
    email: str

class ResetPasswordInput(BaseModel):
    token: str
    new_password: str

def _send_reset_email(to_email: str, token: str) -> None:
    try:
        body = (
            f"Hello,\n\n"
            f"You requested a password reset for your JoslaSync account.\n\n"
            f"Reset token (expires in 1 hour):\n\n  {token}\n\n"
            f"Enter this token on the Reset Password page.\n\n"
            f"If you did not request this, ignore this email.\n\n"
            f"— JoslaSync"
        )
        msg = MIMEText(body)
        msg["Subject"] = "JoslaSync — Password Reset"
        msg["From"] = settings.EMAIL_FROM
        msg["To"] = to_email

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as s:
            s.starttls()
            s.login(settings.SMTP_USER, settings.SMTP_PASS)
            s.sendmail(settings.EMAIL_FROM, [to_email], msg.as_string())
        logger.info(f"📧 Reset email sent to {to_email}")
    except Exception as exc:
        logger.warning(f"⚠️ Could not send reset email: {exc}")


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordInput, db: Session = Depends(get_db)):
    user = auth_repo.get_user_by_email(db, payload.email.strip().lower())
    if not user:
        # Don't reveal whether the email exists
        return {"detail": "If that email is registered, a reset token has been sent."}

    # Expire old tokens for this user
    now = time.time()
    for t, v in list(_reset_tokens.items()):
        if v["user_id"] == user.id or v["expires_at"] < now:
            del _reset_tokens[t]

    token = secrets.token_urlsafe(32)
    _reset_tokens[token] = {"user_id": user.id, "expires_at": now + _TOKEN_TTL}
    _send_reset_email(user.email, token)
    logger.info(f"🔑 Password reset token issued for user {user.username}")

    response: dict = {"detail": "If that email is registered, a reset token has been sent."}
    if settings.DEBUG:
        response["debug_token"] = token  # only in dev mode
    return response


@router.post("/reset-password")
def reset_password(payload: ResetPasswordInput, db: Session = Depends(get_db)):
    now = time.time()
    entry = _reset_tokens.get(payload.token)
    if not entry or entry["expires_at"] < now:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    user = auth_repo.get_user_by_id(db, entry["user_id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    user.hashed_password = hash_password(payload.new_password)
    user.must_change_password = False
    db.commit()
    del _reset_tokens[payload.token]
    logger.info(f"✅ Password reset completed for user {user.username}")
    return {"detail": "Password updated successfully."}


@router.put("/me", response_model=UserRead)
def update_me(
    payload: UserUpdate,
    claims: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's username and/or email."""
    user_id = int(claims.get("id") or claims.get("sub"))
    return auth_repo.update_user(db, user_id, payload.username, payload.email)
