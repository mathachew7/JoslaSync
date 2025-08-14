# app/schemas/company_profile.py
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr, ConfigDict

# Match DB values (lowercase)
Status = Literal["active", "deactivated", "blacklisted"]

class CompanyProfileBase(BaseModel):
    company_name: str
    company_email: EmailStr
    company_mobile: str
    address1: str
    address2: str
    city: str
    state: str
    zip_code: str
    tax_rate: float
    logo_url: Optional[str] = None
    status: Optional[Status] = "active"

class CompanyProfileCreate(CompanyProfileBase):
    pass

class CompanyProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    company_email: Optional[EmailStr] = None
    company_mobile: Optional[str] = None
    address1: Optional[str] = None
    address2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    tax_rate: Optional[float] = None
    status: Optional[Status] = None
    logo_url: Optional[str] = None

class CompanyProfileOut(CompanyProfileBase):
    id: int
    db_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
