# app/schemas/company_settings.py
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, EmailStr, Field, validator


class CompanySettingsBase(BaseModel):
    legal_name: str = Field(default="Josla Tech LLC", max_length=255)
    addr1: Optional[str] = Field(default=None, max_length=255)
    addr2: Optional[str] = Field(default=None, max_length=255)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    zip: Optional[str] = Field(default=None, max_length=20)
    country: Optional[str] = Field(default="UNITED STATES", max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=50)

    pos_state: Optional[str] = Field(default=None, max_length=100)
    default_tax_rate: float = 0.0
    currency_code: str = Field(default="USD", max_length=10)
    currency_symbol: str = Field(default="$", max_length=8)
    date_format: str = Field(default="MM/DD/YYYY", max_length=32)
    number_format: str = Field(default="1,234.56", max_length=32)
    invoice_prefix: str = Field(default="INV-", max_length=32)
    invoice_number_strategy: str = Field(default="prefix-YYYY-####", max_length=64)

    brand_primary_hex: str = "#000033"
    logo_url: Optional[str] = None
    signature_url: Optional[str] = None

    footer_text_page1: Optional[str] = "Terms & Conditions on following page."
    footer_text_other: Optional[str] = "Thank you for your business."
    terms_template: Optional[str] = None
    terms_version: Optional[str] = "v1"

    show_logo_page1: bool = True
    show_logo_all_pages: bool = False
    show_watermark: bool = False

    @validator("brand_primary_hex")
    def _hex(cls, v: str) -> str:
        if not isinstance(v, str) or not v.startswith("#") or len(v) not in (4, 7):
            raise ValueError("brand_primary_hex must be a valid hex color like #000 or #000033")
        return v

    @validator("default_tax_rate")
    def _tax(cls, v: float) -> float:
        if v < 0 or v > 100:
            raise ValueError("default_tax_rate must be between 0 and 100")
        return round(float(v), 3)


class CompanySettingsOut(CompanySettingsBase):
    id: int
    created_at: str
    updated_at: str

    class Config:
        orm_mode = True


class CompanySettingsUpdate(CompanySettingsBase):
    pass
