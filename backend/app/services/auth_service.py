# app/services/auth_service.py
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.logger import logger
from app.schemas.auth import UserCreate, UserRead, LoginInput, LoginResponse
from app.repositories.auth_repo import AuthRepository
from app.repositories.company_profile_repo import CompanyProfileRepository
from app.validators.auth_validator import (
    ensure_unique_username,
    validate_credentials,
    require_refresh_cookie,
)
from app.utils.security import (
    hash_password,
    build_token_payload,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    is_master_credentials,
    is_master_username,
)
from app.core.config import settings


class AuthService:
    def __init__(self):
        self.auth_repo = AuthRepository()
        self.company_repo = CompanyProfileRepository()

    # -------------------------
    # Registration
    # -------------------------
    def register_user(self, user: UserCreate, db: Session) -> UserRead:
        ensure_unique_username(db, user.username, self.auth_repo)
        hashed = hash_password(user.password)
        created = self.auth_repo.create_user(db, user, hashed)
        logger.info(f"✅ User created in DB: {created.username}")
        return UserRead.model_validate(created)

    # -------------------------
    # Login
    # -------------------------
    def login(self, payload: LoginInput, db: Session) -> tuple[LoginResponse, str]:
        username = payload.username
        password = payload.password

        # Master login
        if is_master_credentials(username, password):
            logger.info(f"✅ Master login: {username}")
            # Build canonical claims for master
            claims = build_token_payload(
                user_id=username,
                username="master",
                role="master",
                company_id=None,
                company_slug="master",
                db_name=getattr(settings, "MASTER_DB_NAME", "postgres"),
                extra={"email": settings.MASTER_EMAIL},
            )
            access = create_access_token(claims)
            refresh = create_refresh_token(claims)

            resp = LoginResponse(
                access_token=access,
                refresh_token=refresh,
                user=UserRead(
                    id=0,
                    username="master",
                    email=settings.MASTER_EMAIL,
                    is_active=True,
                    created_at=datetime.utcnow(),
                    role="master",
                ),
            )
            return resp, refresh

        # DB user
        user = self.auth_repo.get_user_by_username(db, username)
        if not user:
            logger.warning(f"❌ Invalid login attempt — user not found: {username}")
        validate_credentials(user, password)

        if not user.company_id:
            logger.error(f"❌ User not linked to a company: {username}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not linked to a company")

        company = self.company_repo.get_by_id(db, user.company_id)
        if not company:
            logger.error(f"❌ Company profile not found for user: {username}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company profile not found")

        # Derive a slug if your master record doesn’t store it explicitly
        company_slug = getattr(company, "slug", None) or company.company_name.lower().replace(" ", "_")

        # Canonical claims (identity + tenant)
        claims = build_token_payload(
            user_id=str(user.id),
            username=user.username,
            role=getattr(user, "role", "user"),
            company_id=str(user.company_id),
            company_slug=company_slug,
            db_name=company.db_name,
            extra={"email": user.email},
        )

        access = create_access_token(claims)
        refresh = create_refresh_token(claims)

        logger.info(f"✅ Tokens issued for user: {username} | db={company.db_name}")
        resp = LoginResponse(
            access_token=access,
            refresh_token=refresh,
            user=UserRead.model_validate(user),
        )
        return resp, refresh

    # -------------------------
    # Refresh
    # -------------------------
    def refresh(self, refresh_token: str, db: Session) -> tuple[LoginResponse, str]:
        require_refresh_cookie(refresh_token)
        payload = decode_refresh_token(refresh_token)

        username = payload.get("username") or payload.get("sub")
        db_name = payload.get("db_name") or payload.get("db")
        if not username or not db_name:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token claims")

        # Master refresh
        if is_master_username(username):
            logger.info(f"🔁 Refresh for master user: {username}")
            # Reuse the decoded claims to preserve tenant context
            claims = {
                k: v
                for k, v in payload.items()
                if k
                in {
                    "sub",
                    "username",
                    "email",
                    "role",
                    "company_id",
                    "company_slug",
                    "db_name",
                    "iat",
                }
            }
            # Ensure required keys exist for master
            claims.setdefault("username", "master")
            claims.setdefault("role", "master")
            access = create_access_token(claims)
            new_refresh = create_refresh_token(claims)

            resp = LoginResponse(
                access_token=access,
                refresh_token=new_refresh,
                user=UserRead(
                    id=0,
                    username="master",
                    email=settings.MASTER_EMAIL,
                    is_active=True,
                    created_at=datetime.utcnow(),
                    role="master",
                ),
            )
            return resp, new_refresh

        # DB user refresh
        user = self.auth_repo.get_user_by_username(db, username)
        if not user:
            logger.warning(f"❌ Refresh failed — user not found: {username}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        company = self.company_repo.get_by_id(db, user.company_id) if user.company_id else None
        if not company:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company profile not found")

        company_slug = getattr(company, "slug", None) or company.company_name.lower().replace(" ", "_")

        # Rebuild claims (keeps tenant context)
        claims = build_token_payload(
            user_id=str(user.id),
            username=user.username,
            role=getattr(user, "role", "user"),
            company_id=str(user.company_id),
            company_slug=company_slug,
            db_name=company.db_name,
            extra={"email": user.email},
        )

        access = create_access_token(claims)
        new_refresh = create_refresh_token(claims)

        logger.info(f"🔁 Token refreshed for user: {username}")
        resp = LoginResponse(
            access_token=access,
            refresh_token=new_refresh,
            user=UserRead.model_validate(user),
        )
        return resp, new_refresh
