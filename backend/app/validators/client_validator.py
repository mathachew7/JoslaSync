# app/validators/client_validator.py
from typing import Optional
from fastapi import HTTPException, status
from app.core.logger import logger
from app.constants.client import CLIENT_STATUSES, CLIENT_STATUSES_SET

def validate_status(value: Optional[str]) -> None:
    if value is None:
        return
    candidate = value.strip().title()
    if candidate not in CLIENT_STATUSES_SET:
        logger.warning(
            f"⚠️ Invalid status provided: '{value}'. Allowed={CLIENT_STATUSES}"
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"status must be one of {CLIENT_STATUSES}",
        )
