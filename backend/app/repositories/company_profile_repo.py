# app/repositories/company_profile_repo.py
from typing import Optional, Mapping, Any
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.db.models.master.company_profile import CompanyProfile as MasterCompanyProfile
from app.db.models.tenant.company_profile import CompanyProfile as TenantCompanyProfile


class CompanyProfileRepository:
    # -------- Master DB --------
    def master_exists_by_name(self, db: Session, company_name: str) -> bool:
        exists = (
            db.query(MasterCompanyProfile)
            .filter_by(company_name=company_name)
            .first()
            is not None
        )
        logger.debug(f"🔎 Master exists check for '{company_name}': {exists}")
        return exists

    def create_master_profile(self, db: Session, company_name: str, db_name: str) -> MasterCompanyProfile:
        master_profile = MasterCompanyProfile(company_name=company_name, db_name=db_name)
        db.add(master_profile)
        db.commit()
        db.refresh(master_profile)
        logger.debug(f"✅ Master profile created: id={master_profile.id}, db_name={db_name}")
        return master_profile

    def get_by_id(self, db: Session, company_id: int) -> Optional[MasterCompanyProfile]:
        logger.debug(f"🔎 Fetch master company by id: {company_id}")
        return db.query(MasterCompanyProfile).filter(MasterCompanyProfile.id == company_id).first()

    def get_by_name(self, db: Session, company_name: str) -> Optional[MasterCompanyProfile]:
        logger.debug(f"🔎 Fetch master company by name: {company_name}")
        return db.query(MasterCompanyProfile).filter(MasterCompanyProfile.company_name == company_name).first()

    # -------- Tenant DB --------
    def get_tenant_profile(self, db: Session) -> Optional[TenantCompanyProfile]:
        return db.query(TenantCompanyProfile).first()

    def create_tenant_profile(self, db: Session, model: TenantCompanyProfile) -> TenantCompanyProfile:
        db.add(model)
        db.commit()
        db.refresh(model)
        logger.debug("✅ Tenant profile created")
        return model

    def update_tenant_profile(
        self,
        db: Session,
        existing: TenantCompanyProfile,
        fields: Mapping[str, Any],
    ) -> TenantCompanyProfile:
        """
        Partial update:
        - Ignore None values (don’t overwrite)
        - Ignore unknown attributes
        """
        for k, v in fields.items():
            if v is None:
                continue
            if hasattr(existing, k):
                setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        logger.debug("📝 Tenant profile updated")
        return existing
