# app/schemas/company_profile.py
from typing import Optional
from pydantic import BaseModel, ConfigDict


class CompanyProfileOut(BaseModel):
    """
    Response schema. All fields mirror DB nullability — only the three NOT NULL
    columns are required; everything else is Optional so model_validate never
    crashes on a partially-filled or freshly-migrated row.
    """
    id: int
    company_name: str
    company_email: str
    company_mobile: str
    db_name: Optional[str] = None
    full_name: Optional[str] = None
    address1: Optional[str] = None
    address2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    tax_rate: Optional[float] = None
    logo_url: Optional[str] = None
    status: Optional[str] = "active"
    terms_and_conditions: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CompanyProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    company_email: Optional[str] = None
    company_mobile: Optional[str] = None
    full_name: Optional[str] = None
    address1: Optional[str] = None
    address2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    tax_rate: Optional[float] = None
    status: Optional[str] = None
    logo_url: Optional[str] = None
    terms_and_conditions: Optional[str] = None
