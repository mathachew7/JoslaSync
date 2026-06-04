# app/validators/invoice_validator.py
from decimal import Decimal
from typing import List
from fastapi import HTTPException, status
from app.schemas.invoice import InvoiceCreate, DiscountType

def _bad(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

def validate_invoice_create(data: InvoiceCreate):
    # dates
    if data.due_date and data.due_date < data.invoice_date:
        raise _bad("due_date must be on or after invoice_date.")

    # item-level checks
    if not data.items:
        raise _bad("At least one line item is required.")

    any_valid = False
    for idx, it in enumerate(data.items, start=1):
        desc = (it.description or "").strip()
        if it.quantity < 0 or it.unit_price < 0:
            raise _bad(f"Line {idx}: quantity and unit_price must be ≥ 0.")
        if desc and it.quantity > 0 and it.unit_price > 0:
            any_valid = True
    if not any_valid:
        raise _bad(
            "At least one line item must have a description and quantity > 0 and unit_price > 0."
        )

    # discount validation
    if data.discount_enabled:
        if data.discount_type == DiscountType.PERCENT:
            # allow 0..100 (0 means no discount; compute_totals already handles it)
            if data.discount_value < 0 or data.discount_value > Decimal("100"):
                raise _bad("Percent discount must be between 0 and 100.")
        elif data.discount_type == DiscountType.FLAT:
            # allow zero; reject negatives
            if data.discount_value < 0:
                raise _bad("Flat discount must be ≥ 0.")
        else:
            # schema should require discount_type when enabled, but keep a friendly guard
            raise _bad("discount_type is required when discount_enabled is true.")

    # tax validation (0..100 inclusive)
    if data.tax_rate < 0 or data.tax_rate > Decimal("100"):
        raise _bad("Tax rate must be between 0 and 100.")
