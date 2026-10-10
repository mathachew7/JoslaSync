# app/api/routes/auth.py
from fastapi import APIRouter, Depends, Response, Request, HTTPException, status
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.core.config import settings
from app.db.database import get_db
from app.db.deps import get_current_user, require_super_admin  # <-- make sure this returns claims from JWT
from app.schemas.auth import UserCreate, UserRead, LoginInput, LoginResponse, SetPasswordInput, UserUpdate
from app.services.auth_service import AuthService
from app.repositories.auth_repo import AuthRepository
from app.repositories.company_profile_repo import CompanyProfileRepository
from app.utils.response_utils import set_refresh_cookie
from app.utils.rate_limit import check_rate_limit, client_ip

router = APIRouter()
service = AuthService()
auth_repo = AuthRepository()
company_repo = CompanyProfileRepository()

@router.post("/register", response_model=UserRead)
def register_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    _admin: dict = Depends(require_super_admin),
):
    """Admin-only: the login page's own copy says 'Registration is private' —
    this endpoint used to be fully public, which let anyone self-register a
    super_admin account via an unverified @joslatech.com email. Tenant
    creation should go through POST /api/admin/tenants instead; this route
    stays only for any code path that still depends on it, now properly gated."""
    logger.info(f"➡️ POST /auth/register | by={_admin.get('username')} | new_user={user.username}")
    result = service.register_user(user, db)
    logger.info(f"✅ User registered: {result.username}")
    return result

@router.post("/login", response_model=LoginResponse)
def login(payload: LoginInput, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = client_ip(request)
    check_rate_limit(f"login:ip:{ip}", max_attempts=20, window_seconds=60)
    check_rate_limit(f"login:user:{ip}:{payload.username}", max_attempts=5, window_seconds=60)
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


@router.put("/me", response_model=UserRead)
def update_me(
    payload: UserUpdate,
    claims: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's username and/or email."""
    user_id = int(claims.get("id") or claims.get("sub"))
    return auth_repo.update_user(db, user_id, payload.username, payload.email)
