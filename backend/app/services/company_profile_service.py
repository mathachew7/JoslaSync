# app/services/company_profile_service.py
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.core.logger import logger
from app.db.database import BaseTenant, get_tenant_session, ensure_tenant_tables
from app.db.models.user import User
from app.db.models.tenant.company_profile import CompanyProfile as TenantCompanyProfile
from app.schemas.company_profile import CompanyProfileOut
from app.validators.company_profile_validator import validate_fields
from app.repositories.company_profile_repo import CompanyProfileRepository
from app.utils.file_utils import save_logo_file
from app.utils.db_utils import create_company_database
from app.utils.security import hash_password

# Ensure tenant tables are registered (module import to populate metadata)
from app.db.models.tenant import company_settings as _company_settings  # noqa: F401
from app.services.company_settings_service import get_or_create_settings


class CompanyProfileService:
    def __init__(self):
        self.repo = CompanyProfileRepository()

    def register(
        self,
        master_db: Session,
        company_name: str,
        company_email: str,
        company_mobile: str,
        logo_file,
        address1: str,
        address2: str,
        city: str,
        state: str,
        zip_code: str,
        tax_rate: float,
        admin_username: str,
        admin_email: str,
        admin_password: str,
        status: str,
    ) -> CompanyProfileOut:
        # 1) Guard: unique in master
        if self.repo.master_exists_by_name(master_db, company_name):
            logger.warning("Company already exists in master.")
            raise HTTPException(status_code=400, detail="Company already exists.")

        # 2) Validate + save logo
        validate_fields(company_email, company_mobile, city, zip_code, tax_rate, logo_file)
        logo_url = save_logo_file(logo_file)

        # 3) Create tenant DB (physical)
        db_name = company_name.lower().replace(" ", "_") + "_db"
        try:
            create_company_database(db_name)
        except Exception as e:
            logger.error(f"❌ Failed to create DB: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create DB: {str(e)}")

        # 4) Persist master record (links name -> db_name, returns master profile)
        master_profile = self.repo.create_master_profile(master_db, company_name, db_name)

        # 5) Create admin user (master scope)
        hashed_password = hash_password(admin_password)
        admin_user = User(
            username=admin_username,
            email=admin_email,
            hashed_password=hashed_password,
            is_active=True,
            company_id=master_profile.id,
        )
        master_db.add(admin_user)
        master_db.commit()

        # 6) Bootstrap tenant schema + open tenant session
        try:
            # Ensure tenant tables exist (idempotent)
            ensure_tenant_tables(db_name)
        except Exception:
            logger.exception(f"❌ Failed ensuring tenant tables for '{db_name}'")
            raise HTTPException(status_code=500, detail="Failed to prepare tenant schema")

        TenantSessionLocal = get_tenant_session(db_name)
        tenant_db = TenantSessionLocal()

        try:
            # Redundant safety: ensure metadata is bound (ok if tables already exist)
            BaseTenant.metadata.create_all(bind=tenant_db.get_bind())

            # 7) Insert tenant profile row
            tenant_profile = self.repo.create_tenant_profile(
                tenant_db,
                TenantCompanyProfile(
                    company_name=company_name,
                    company_email=company_email,
                    company_mobile=company_mobile,
                    logo_url=logo_url,
                    address1=address1,
                    address2=address2,
                    city=city,
                    state=state,
                    zip_code=zip_code,
                    tax_rate=tax_rate,
                    status=status,
                    db_name=db_name,
                ),
            )

            # 8) Seed company_settings
            logger.info(f"🆕 Seeding company_settings for tenant: {company_name} ({db_name})")
            get_or_create_settings(tenant_db)
            logger.info("✅ company_settings seeded")

            logger.info("✅ Registered & stored in both master and tenant DB.")
            return CompanyProfileOut.model_validate(tenant_profile, from_attributes=True)

        except Exception:
            logger.exception("❌ Failed to save profile in tenant DB")
            raise HTTPException(status_code=500, detail="Failed to save profile in tenant DB")
        finally:
            tenant_db.close()

    def update(
        self,
        tenant_db: Session,
        company_name: Optional[str] = None,
        company_email: Optional[str] = None,
        company_mobile: Optional[str] = None,
        logo_file: Optional[Any] = None,
        address1: Optional[str] = None,
        address2: Optional[str] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        zip_code: Optional[str] = None,
        tax_rate: Optional[float] = None,
        status: Optional[str] = None,
    ) -> CompanyProfileOut:
        existing = self.repo.get_tenant_profile(tenant_db)
        if not existing:
            logger.warning("No profile found to update.")
            raise HTTPException(status_code=404, detail="No profile exists. Use register endpoint.")

        # Only validate what changes; logo may be omitted
        if any(v is not None for v in [company_email, company_mobile, city, zip_code, tax_rate, logo_file]):
            validate_fields(
                company_email or existing.company_email,
                company_mobile or existing.company_mobile,
                city or existing.city,
                zip_code or existing.zip_code,
                tax_rate if tax_rate is not None else existing.tax_rate,
                logo_file or None,
            )

        logo_url = existing.logo_url
        if logo_file is not None:
            logo_url = save_logo_file(logo_file)

        fields: Dict[str, Any] = {
            **({"company_name": company_name} if company_name is not None else {}),
            **({"company_email": company_email} if company_email is not None else {}),
            **({"company_mobile": company_mobile} if company_mobile is not None else {}),
            **({"logo_url": logo_url} if logo_url is not None else {}),
            **({"address1": address1} if address1 is not None else {}),
            **({"address2": address2} if address2 is not None else {}),
            **({"city": city} if city is not None else {}),
            **({"state": state} if state is not None else {}),
            **({"zip_code": zip_code} if zip_code is not None else {}),
            **({"tax_rate": tax_rate} if tax_rate is not None else {}),
            **({"status": status} if status is not None else {}),
        }

        updated = self.repo.update_tenant_profile(tenant_db, existing, fields)
        logger.info(f"Company profile updated for '{updated.company_name}'.")
        return CompanyProfileOut.model_validate(updated, from_attributes=True)

    def get(self, tenant_db: Session) -> CompanyProfileOut:
        profile = self.repo.get_tenant_profile(tenant_db)
        if not profile:
            logger.warning("Company profile not found.")
            raise HTTPException(status_code=404, detail="Company profile not found.")
        logger.info(f"Fetched company profile: {profile.company_name}")
        return CompanyProfileOut.model_validate(profile, from_attributes=True)
