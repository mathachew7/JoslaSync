# app/services/admin_service.py
import re
from collections import defaultdict
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.logger import logger
from app.schemas.admin import TenantCreate, TenantRead, TenantUserRead, AdminStats, ResetPasswordResponse, TenantFeaturesOut
from app.db.models.master.tenant_features import TenantFeature, VALID_FEATURES
from app.repositories.auth_repo import AuthRepository
from app.repositories.company_profile_repo import CompanyProfileRepository
from app.utils.security import hash_password
from app.db.database import create_tenant_database_if_missing, ensure_tenant_tables


def _tenant_read(company, users) -> TenantRead:
    return TenantRead(
        id=company.id,
        company_name=company.company_name,
        db_name=company.db_name,
        status=company.status or "active",
        created_at=company.created_at,
        updated_at=company.updated_at,
        users=[TenantUserRead.model_validate(u) for u in users],
    )


class AdminService:
    def __init__(self):
        self.auth_repo = AuthRepository()
        self.company_repo = CompanyProfileRepository()

    def list_tenants(self, db: Session) -> list[TenantRead]:
        companies = self.company_repo.get_all_companies(db)
        return [
            _tenant_read(c, self.auth_repo.get_users_by_company_id(db, c.id))
            for c in companies
        ]

    def get_tenant_detail(self, company_id: int, db: Session) -> TenantRead:
        company = self.company_repo.get_by_id(db, company_id)
        if not company:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
        return _tenant_read(company, self.auth_repo.get_users_by_company_id(db, company.id))

    def create_tenant(self, body: TenantCreate, db: Session) -> TenantRead:
        if self.company_repo.master_exists_by_name(db, body.company_name.strip()):
            raise HTTPException(status_code=400, detail=f"Company '{body.company_name}' already exists")

        existing = self.auth_repo.get_user_by_login(db, body.username_or_email)
        if existing:
            raise HTTPException(status_code=400, detail=f"'{body.username_or_email}' is already registered")

        safe = re.sub(r"[^a-z0-9_]", "", body.company_name.lower().replace(" ", "_"))
        db_name = f"{safe}_db" if safe else "company_db"

        company = self.company_repo.create_master_profile(db, body.company_name.strip(), db_name)
        logger.info(f"✅ Admin created company: {company.id} db={db_name}")

        create_tenant_database_if_missing(db_name)
        ensure_tenant_tables(db_name)

        # Derive username: use as-is if not email, else take local part
        identifier = body.username_or_email
        username = identifier.split("@")[0] if "@" in identifier else identifier
        email = identifier if "@" in identifier else f"{identifier}@placeholder.local"

        hashed = hash_password(body.temp_password)
        user = self.auth_repo.create_tenant_user(
            db,
            username=username,
            email=email,
            hashed_password=hashed,
            company_id=company.id,
        )
        logger.info(f"✅ Admin created tenant user: {user.username} (must_change_password=True)")

        return _tenant_read(company, [user])

    def update_tenant_status(self, company_id: int, new_status: str, db: Session) -> TenantRead:
        company = self.company_repo.get_by_id(db, company_id)
        if not company:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
        updated = self.company_repo.update_company_status(db, company, new_status)
        return _tenant_read(updated, self.auth_repo.get_users_by_company_id(db, updated.id))

    def reset_user_password(self, user_id: int, db: Session) -> ResetPasswordResponse:
        user = self.auth_repo.get_user_by_id(db, user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        import secrets, string
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        # Guarantee at least one upper, digit, special
        temp = (
            secrets.choice(string.ascii_uppercase) +
            secrets.choice(string.digits) +
            secrets.choice("!@#$%^&*") +
            "".join(secrets.choice(alphabet) for _ in range(9))
        )
        # Shuffle
        lst = list(temp)
        secrets.SystemRandom().shuffle(lst)
        temp_password = "".join(lst)

        user.hashed_password = hash_password(temp_password)
        user.must_change_password = True
        db.commit()
        db.refresh(user)
        logger.info(f"🔑 Admin reset password for user: {user.username}")

        return ResetPasswordResponse(
            user=TenantUserRead.model_validate(user),
            temp_password=temp_password,
        )

    def _get_features_dict(self, company_id: int, db: Session) -> dict:
        rows = db.query(TenantFeature).filter(TenantFeature.company_id == company_id).all()
        existing = {r.feature_key: r.enabled for r in rows}
        return {key: existing.get(key, True) for key in VALID_FEATURES}

    def get_tenant_features(self, company_id: int, db: Session) -> TenantFeaturesOut:
        if not self.company_repo.get_by_id(db, company_id):
            raise HTTPException(status_code=404, detail="Tenant not found")
        return TenantFeaturesOut(**self._get_features_dict(company_id, db))

    def update_tenant_feature(self, company_id: int, feature_key: str, enabled: bool, db: Session) -> TenantFeaturesOut:
        if not self.company_repo.get_by_id(db, company_id):
            raise HTTPException(status_code=404, detail="Tenant not found")
        row = db.query(TenantFeature).filter(
            TenantFeature.company_id == company_id,
            TenantFeature.feature_key == feature_key,
        ).first()
        if row:
            row.enabled = enabled
        else:
            db.add(TenantFeature(company_id=company_id, feature_key=feature_key, enabled=enabled))
        db.commit()
        logger.info(f"✅ Feature '{feature_key}' set to {enabled} for company {company_id}")
        return TenantFeaturesOut(**self._get_features_dict(company_id, db))

    def get_stats(self, db: Session) -> AdminStats:
        companies = self.company_repo.get_all_companies(db)
        all_users = self.auth_repo.get_all_users(db)

        now = datetime.now(timezone.utc)
        active = sum(1 for c in companies if (c.status or "active") == "active")
        suspended = len(companies) - active
        this_month = sum(
            1 for c in companies
            if c.created_at and c.created_at.year == now.year and c.created_at.month == now.month
        )

        # Monthly growth — last 12 months
        monthly: dict = defaultdict(int)
        for c in companies:
            if c.created_at:
                key = c.created_at.strftime("%Y-%m")
                monthly[key] += 1

        # Build ordered list for the last 12 months
        growth = []
        for i in range(11, -1, -1):
            from calendar import month_abbr
            m = now.month - i
            y = now.year
            while m <= 0:
                m += 12
                y -= 1
            key = f"{y}-{m:02d}"
            growth.append({"month": month_abbr[m], "year": y, "tenants": monthly.get(key, 0)})

        return AdminStats(
            total_tenants=len(companies),
            active_tenants=active,
            suspended_tenants=suspended,
            total_users=len(all_users),
            tenants_this_month=this_month,
            monthly_growth=growth,
        )
