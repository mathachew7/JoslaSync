# app/validators/company_settings_validator.py
from __future__ import annotations
from typing import Tuple, Union
from pydantic import ValidationError
from app.schemas.company_settings import CompanySettingsUpdate

def validate_company_settings(payload: dict) -> Tuple[bool, Union[CompanySettingsUpdate, list]]:
    try:
        model = CompanySettingsUpdate(**payload)
        return True, model
    except ValidationError as e:
        return False, e.errors()
