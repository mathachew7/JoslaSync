# app/api/routes/company_profile.py
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.db.database import get_db
from app.db.deps import get_company_db  # tenant-scoped session
from app.schemas.company_profile import CompanyProfileOut
from app.services.company_profile_service import CompanyProfileService

# Tenant bootstrap helpers (idempotent)
from app.db.database import (
    create_tenant_database_if_missing,
    ensure_tenant_tables,
)

router = APIRouter()
service = CompanyProfileService()


@router.post("/company-profile", response_model=CompanyProfileOut)
def register_company_profile(
    company_name: str = Form(...),
    company_email: str = Form(...),
    company_mobile: str = Form(...),
    logoFile: UploadFile = File(...),
    address1: str = Form(...),
    address2: str = Form(...),
    city: str = Form(...),
    state: str = Form(...),
    zip_code: str = Form(...),
    tax_rate: float = Form(...),  # ✅ float, not str
    full_name: str = Form(...), 
    admin_username: str = Form(...),
    admin_email: str = Form(...),
    admin_password: str = Form(...),
    status: str = Form("Active"),
    master_db: Session = Depends(get_db),
):
    """
    Registers a new company in the MASTER DB, creates tenant DB if missing,
    creates tenant tables, and returns the created profile (including db_name).
    """
    logger.info(f"🚀 Registering company: {company_name}")

    profile: CompanyProfileOut = service.register(
        master_db=master_db,
        company_name=company_name,
        company_email=company_email,
        company_mobile=company_mobile,
        logo_file=logoFile,
        address1=address1,
        address2=address2,
        city=city,
        state=state,
        full_name=full_name,
        zip_code=zip_code,
        tax_rate=tax_rate,
        admin_username=admin_username,
        admin_email=admin_email,
        admin_password=admin_password,
        status=status,
    )

    # Bootstrap tenant DB + tables
    db_name = getattr(profile, "db_name", None) or getattr(profile, "tenant_db", None)
    if not db_name:
        logger.error("❌ CompanyProfileOut missing db_name/tenant_db")
        raise HTTPException(status_code=500, detail="Tenant database name missing after registration")

    try:
        create_tenant_database_if_missing(db_name)
    except Exception as e:
        # If DB exists, continue; otherwise surface later
        logger.warning(f"⚠️ create_tenant_database_if_missing({db_name}) warning: {e}")

    ensure_tenant_tables(db_name)
    logger.info(f"🔧 Tenant DB + tables ready for '{db_name}'")

    return profile


@router.put("/company-profile", response_model=CompanyProfileOut)
def update_company_profile(
    # ✅ all optional for partial updates
    company_name: Optional[str] = Form(None),
    company_email: Optional[str] = Form(None),
    company_mobile: Optional[str] = Form(None),
    logoFile: Optional[UploadFile] = File(None),
    address1: Optional[str] = Form(None),
    address2: Optional[str] = Form(None),
    full_name: Optional[str] = Form(None),
    city: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    zip_code: Optional[str] = Form(None),
    tax_rate: Optional[float] = Form(None),
    status: Optional[str] = Form(None),
    terms_and_conditions: Optional[str] = Form(None),
    tenant_db: Session = Depends(get_company_db),
):
    """
    Updates the current tenant's company profile (partial allowed).
    """
    return service.update(
        tenant_db=tenant_db,
        company_name=company_name,
        company_email=company_email,
        company_mobile=company_mobile,
        logo_file=logoFile,
        address1=address1,
        address2=address2,
        city=city,
        full_name=full_name,
        state=state,
        zip_code=zip_code,
        tax_rate=tax_rate,
        status=status,
        terms_and_conditions=terms_and_conditions,
    )


@router.get("/company-profile", response_model=CompanyProfileOut)
def get_company_profile(tenant_db: Session = Depends(get_company_db)):
    """
    Returns the current tenant's company profile.
    """
    return service.get(tenant_db=tenant_db)
