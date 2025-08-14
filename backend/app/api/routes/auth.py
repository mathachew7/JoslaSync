# app/api/routes/auth.py
from fastapi import APIRouter, Depends, Response, Request, HTTPException, status
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.core.config import settings
from app.db.database import get_db
from app.db.deps import get_current_user  # <-- make sure this returns claims from JWT
from app.schemas.auth import UserCreate, UserRead, LoginInput, LoginResponse
from app.services.auth_service import AuthService
from app.repositories.auth_repo import AuthRepository
from app.repositories.company_profile_repo import CompanyProfileRepository
from app.utils.response_utils import set_refresh_cookie
from app.utils.security import is_master_username

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

# ✅ NEW: whoami endpoint used by the frontend to bootstrap auth context
@router.get("/me")
def me(claims: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns current user + company context based on the access token.
    Does NOT require tenant DB; reads user/company from master DB.
    """
    username = claims.get("username") or claims.get("sub")
    db_name = claims.get("db_name") or claims.get("db")

    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    # Master user shortcut
    if is_master_username(username):
        return {
            "user": {
                "id": 0,
                "username": "master",
                "email": settings.MASTER_EMAIL,
                "role": "master",
            },
            "company": {"db_name": db_name},
        }

    # Lookup user in master DB
    user = auth_repo.get_user_by_username(db, username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Fetch company (for db_name) if linked
    company = company_repo.get_by_id(db, user.company_id) if getattr(user, "company_id", None) else None

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": getattr(user, "role", "user"),
        },
        "company": {"db_name": getattr(company, "db_name", db_name)},
    }
