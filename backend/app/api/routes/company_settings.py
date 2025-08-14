# app/api/routes/company_settings.py
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, Body
from sqlalchemy.orm import Session

from app.db.deps import get_company_db, get_current_user  # 👈 keep your alias
from app.schemas.company_settings import CompanySettingsOut, CompanySettingsUpdate
from app.services.company_settings_service import get_or_create_settings, update_settings
from app.validators.company_settings_validator import validate_company_settings
from app.utils.file_utils import save_logo_file, save_signature_file

router = APIRouter(prefix="/company", tags=["Company Settings"])
log = logging.getLogger("app.api.routes.company_settings")

def _to_bool(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    return str(v).strip().lower() in ("1", "true", "t", "yes", "y", "on")


@router.get("/settings", response_model=CompanySettingsOut)
def get_settings(
    db: Session = Depends(get_company_db),
    _user=Depends(get_current_user),
):
    log.info("🔎 Fetching company settings")
    settings = get_or_create_settings(db)
    return settings


@router.put("/settings", response_model=CompanySettingsOut, status_code=status.HTTP_200_OK)
async def put_settings(
    db: Session = Depends(get_company_db),
    _user=Depends(get_current_user),

    # Optional uploads
    logo: Optional[UploadFile] = File(default=None),
    signature: Optional[UploadFile] = File(default=None),

    # Optional form fields
    legal_name: Optional[str] = Form(default=None),
    addr1: Optional[str] = Form(default=None),
    addr2: Optional[str] = Form(default=None),
    city: Optional[str] = Form(default=None),
    state: Optional[str] = Form(default=None),
    zip: Optional[str] = Form(default=None),
    country: Optional[str] = Form(default=None),
    email: Optional[str] = Form(default=None),
    phone: Optional[str] = Form(default=None),

    pos_state: Optional[str] = Form(default=None),
    default_tax_rate: Optional[float] = Form(default=None),
    currency_code: Optional[str] = Form(default=None),
    currency_symbol: Optional[str] = Form(default=None),
    date_format: Optional[str] = Form(default=None),
    number_format: Optional[str] = Form(default=None),
    invoice_prefix: Optional[str] = Form(default=None),
    invoice_number_strategy: Optional[str] = Form(default=None),

    brand_primary_hex: Optional[str] = Form(default=None),

    footer_text_page1: Optional[str] = Form(default=None),
    footer_text_other: Optional[str] = Form(default=None),
    terms_template: Optional[str] = Form(default=None),
    terms_version: Optional[str] = Form(default=None),

    show_logo_page1: Optional[bool] = Form(default=None),
    show_logo_all_pages: Optional[bool] = Form(default=None),
    show_watermark: Optional[bool] = Form(default=None),
):
    log.info("🛠 Updating company settings (multipart)")

    payload = {}
    for k, v in {
        "legal_name": legal_name,
        "addr1": addr1,
        "addr2": addr2,
        "city": city,
        "state": state,
        "zip": zip,
        "country": country,
        "email": email,
        "phone": phone,
        "pos_state": pos_state,
        "default_tax_rate": default_tax_rate,
        "currency_code": currency_code,
        "currency_symbol": currency_symbol,
        "date_format": date_format,
        "number_format": number_format,
        "invoice_prefix": invoice_prefix,
        "invoice_number_strategy": invoice_number_strategy,
        "brand_primary_hex": brand_primary_hex,
        "footer_text_page1": footer_text_page1,
        "footer_text_other": footer_text_other,
        "terms_template": terms_template,
        "terms_version": terms_version,
        "show_logo_page1": show_logo_page1,
        "show_logo_all_pages": show_logo_all_pages,
        "show_watermark": show_watermark,
    }.items():
        if v is not None:
            payload[k] = v

    # Coerce boolean-ish form values
    for k in ("show_logo_page1", "show_logo_all_pages", "show_watermark"):
        if k in payload:
            payload[k] = _to_bool(payload[k])

    # Handle uploads
    if logo is not None:
        try:
            payload["logo_url"] = save_logo_file(logo)
        except Exception as e:
            log.exception("Logo upload failed")
            raise HTTPException(status_code=400, detail=f"Logo upload failed: {e}")

    if signature is not None:
        try:
            payload["signature_url"] = save_signature_file(signature)
        except Exception as e:
            log.exception("Signature upload failed")
            raise HTTPException(status_code=400, detail=f"Signature upload failed: {e}")

    ok, data_or_err = validate_company_settings(payload)
    if not ok:
        raise HTTPException(status_code=422, detail=data_or_err)

    settings = update_settings(db, data_or_err)
    log.info("✅ Company settings updated")
    return settings


# Optional JSON-only endpoint (keep or delete; uses your existing schema)
@router.put("/settings/json", response_model=CompanySettingsOut, status_code=status.HTTP_200_OK)
def put_settings_json(
    payload: CompanySettingsUpdate = Body(...),
    db: Session = Depends(get_company_db),
    _user=Depends(get_current_user),
):
    log.info("🛠 Updating company settings (JSON)")
    settings = update_settings(db, payload)
    log.info("✅ Company settings updated (JSON)")
    return settings
