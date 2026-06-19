from typing import List, Optional, Mapping, Any
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.db.models.master.company_profile import Company
from app.db.models.tenant.company_profile import CompanyProfile as TenantCompanyProfile


class CompanyProfileRepository:
    # -------- Master DB (companies table) --------

    def master_exists_by_name(self, db: Session, company_name: str) -> bool:
        return db.query(Company).filter_by(company_name=company_name).first() is not None

    def get_all_companies(self, db: Session) -> List[Company]:
        return db.query(Company).order_by(Company.created_at.desc()).all()

    def update_company_status(self, db: Session, company: Company, status: str) -> Company:
        company.status = status
        db.commit()
        db.refresh(company)
        return company

    def create_master_profile(self, db: Session, company_name: str, db_name: str) -> Company:
        record = Company(company_name=company_name, db_name=db_name)
        db.add(record)
        db.commit()
        db.refresh(record)
        logger.debug(f"✅ Company created: id={record.id} db={db_name}")
        return record

    def get_by_id(self, db: Session, company_id: int) -> Optional[Company]:
        return db.query(Company).filter(Company.id == company_id).first()

    def get_by_name(self, db: Session, company_name: str) -> Optional[Company]:
        return db.query(Company).filter(Company.company_name == company_name).first()

    # -------- Tenant DB (company_profile table) --------

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
        for k, v in fields.items():
            if v is None:
                continue
            if hasattr(existing, k):
                setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        logger.debug("📝 Tenant profile updated")
        return existing
