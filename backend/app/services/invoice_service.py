# app/services/invoice_service.py
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID as UUID_T
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date
from math import ceil

from sqlalchemy.orm import Session
from sqlalchemy import select, func, cast, Integer  # 👈 added cast, Integer, select/func already used elsewhere

from app.schemas.invoice import DiscountType, InvoiceCreate
from app.db.models.tenant.client import Client
from app.db.models.tenant.company_profile import CompanyProfile  # type: ignore
from app.db.models.tenant.invoice import Invoice

# -------------------------------------------------------------------
# logger setup
# -------------------------------------------------------------------
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

_TWO = Decimal("0.01")

def _to_decimal(x: Any) -> Decimal:
    if isinstance(x, Decimal):
        return x
    return Decimal(str(x))

def money(x: Any) -> Decimal:
    """Quantize to 2 decimals, HALF_UP (accounting style)."""
    return _to_decimal(x).quantize(_TWO, rounding=ROUND_HALF_UP)

# ---- totals computation -----------------------------------------------------

def compute_totals(
    items: List[Dict[str, Any]],
    discount_enabled: bool,
    discount_type: Optional[DiscountType],
    discount_value: Decimal,
    tax_rate: Decimal,
) -> Dict[str, Decimal]:
    logger.info("🧮 Computing totals for %d items", len(items))
    subtotal = money(sum(money(it["quantity"]) * money(it["unit_price"]) for it in items))

    discount_amount = Decimal("0.00")
    if discount_enabled and discount_value and _to_decimal(discount_value) > 0:
        if discount_type == DiscountType.PERCENT:
            discount_amount = money(subtotal * _to_decimal(discount_value) / Decimal("100"))
        else:
            discount_amount = money(discount_value)

    taxable = max(Decimal("0.00"), subtotal - discount_amount)
    tax_amount = money(taxable * _to_decimal(tax_rate or 0) / Decimal("100"))
    total = money(taxable + tax_amount)

    return {
        "subtotal": subtotal,
        "discount_amount": discount_amount,
        "tax_amount": tax_amount,
        "total": total,
    }

# ---- invoice numbering (collision-safe) -------------------------------------

def _pg_advisory_lock_month(session: Session, company_id: Optional[int], yyyymm: str) -> None:
    """
    Transaction-scoped advisory lock to serialize number assignment per (company, month).
    Uses two 32-bit keys: (0, hash(company_id:yyyymm)).
    """
    key_hi = 0
    key_lo = abs(hash(f"invno:{company_id or 0}:{yyyymm}")) % (2**31)
    # pg_advisory_xact_lock(key_hi, key_lo) holds the lock for the current transaction
    session.execute(func.pg_advisory_xact_lock(key_hi, key_lo))

def next_invoice_no(db: Session, company_id: Optional[int]) -> str:
    """
    Generate a unique invoice number like INV-YYYYMM-00001, safe under concurrency.
    - Locks per (company, month) to avoid races.
    - Looks at **all** invoices (DRAFT/INVOICE/VOID) for the month so numbers are never reused.
    """
    today = date.today()
    yyyymm = f"{today:%Y%m}"
    prefix = f"INV-{yyyymm}-"

    # Serialize number picking within this txn
    _pg_advisory_lock_month(db, company_id, yyyymm)

    # Find the max numerical suffix used with this prefix for this company
    like_pattern = f"{prefix}%"
    # substr(invoice_no, start) -> suffix string; cast to int; take max
    stmt = (
        select(func.max(cast(func.substr(Invoice.invoice_no, len(prefix) + 1), Integer)))
        .where(Invoice.company_id == company_id, Invoice.invoice_no.like(like_pattern))
    )
    max_suffix = db.execute(stmt).scalar()
    next_suffix = (max_suffix or 0) + 1
    return f"{prefix}{next_suffix:05d}"

# ---- snapshot + PDF payload assembly ---------------------------------------

def _snapshot_company(cp: Optional[CompanyProfile]) -> Dict[str, Any]:
    if not cp:
        return {
            "companyName": "Company",
            "companyEmail": "",
            "companyMobile": "",
            "companyAddress1": "",
            "companyAddress2": "",
            "companyLogoDataUrl": "",
        }
    return {
        "companyName": getattr(cp, "company_name", None) or getattr(cp, "name", None) or "Company",
        "companyEmail": getattr(cp, "company_email", None) or "",
        "companyMobile": getattr(cp, "company_mobile", None) or getattr(cp, "phone", None) or "",
        "companyAddress1": getattr(cp, "address1", None) or "",
        "companyAddress2": getattr(cp, "address2", None) or "",
        "companyLogoDataUrl": getattr(cp, "logo_url", None) or "",
        "companyCity": getattr(cp, "city", None) or "",
        "companyState": getattr(cp, "state", None) or "",
        "companyPostal": getattr(cp, "postal_code", None) or "",
        "companyCountry": getattr(cp, "country", None) or "",
    }

def _snapshot_client(client: Client) -> Dict[str, Any]:
    return {
        "selectedClient": client.name,
        "clientCompany": client.company or "",
        "clientEmail": client.email or "",
        "clientPhone": client.phone or "",
        "clientAddress1": client.address_line1 or "",
        "clientAddress2": client.address_line2 or "",
        "clientCity": client.city or "",
        "clientState": client.state or "",
        "clientZip": client.postal_code or "",
        "clientCountry": client.country or "",
        "shippingAddress1": client.address_line1 or "",
        "shippingAddress2": client.address_line2 or "",
        "shippingCity": client.city or "",
        "shippingState": client.state or "",
        "shippingZip": client.postal_code or "",
        "shippingCountry": client.country or "",
    }

def build_frozen_payload(
    db: Session,
    create: InvoiceCreate,
    invoice_no: str,
    totals: Dict[str, Decimal],
    created_by_name: Optional[str],
) -> Dict[str, Any]:
    client = db.query(Client).filter(Client.id == create.client_id).one()
    cp = db.query(CompanyProfile).filter(CompanyProfile.id == create.company_id).first() if create.company_id else None
    company_block = _snapshot_company(cp)
    client_block = _snapshot_client(client)

    line_items = [
        {"description": it.description, "quantity": float(it.quantity), "price": float(it.unit_price)}
        for it in sorted(create.items, key=lambda x: x.sno)
    ]

    return {
        "status": (create.status.value if hasattr(create.status, "value") else str(create.status)) if create.status else "DRAFT",
        "invoiceTitle": (create.invoice_title or "").strip(),
        "invoiceDate": create.invoice_date.isoformat(),
        "invoiceNumber": invoice_no,
        "dueDate": create.due_date.isoformat() if create.due_date else None,
        "createdBy": created_by_name or "",
        "pos": create.place_of_supply or "",
        **company_block,
        **client_block,
        "lineItems": line_items,
        "discountEnabled": bool(create.discount_enabled),
        "discountType": (create.discount_type.value.lower() if create.discount_type else "percent"),
        "discountValue": float(create.discount_value or 0),
        "footerMessage": create.footer_message or "",
        "subtotal": float(totals["subtotal"]),
        "discountAmount": float(totals["discount_amount"]),
        "tax": float(totals["tax_amount"]),
        "total": float(totals["total"]),
        "additionalInformation": create.additional_information_raw or "",
    }

# --- pagination + analytics wrappers (APPEND ONLY, with local imports) ------

def list_invoices_with_meta(
    db: Session,
    *,
    client_id: Optional[UUID_T] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort: Optional[str] = "invoice_date",
    order: Optional[str] = "desc",
    page: int = 1,
    page_size: int = 10,
) -> Tuple[List[Invoice], Dict[str, int]]:
    # ✅ local import to avoid circular dependency
    from app.crud import invoice as invoice_crud

    offset = (page - 1) * page_size
    total = invoice_crud.count_invoices(
        db, client_id=client_id, status=status, qtext=q, date_from=date_from, date_to=date_to
    )
    rows = invoice_crud.list_invoices(
        db,
        client_id=client_id,
        status=status,
        qtext=q,
        date_from=date_from,
        date_to=date_to,
        sort=sort,
        order=order,
        limit=page_size,
        offset=offset,
    )
    meta = {
        "page": page,
        "page_size": page_size,
        "total": total,
        "pages": ceil(total / page_size) if page_size else 1,
    }
    return rows, meta

def get_invoice_stats(db: Session) -> dict:
    from app.crud import invoice as invoice_crud  # ✅ local import
    return invoice_crud.get_invoice_stats(db)

def get_monthly_totals(db: Session, *, year_from: int, year_to: int) -> List[dict]:
    from app.crud import invoice as invoice_crud  # ✅ local import
    return invoice_crud.get_monthly_totals(db, year_from=year_from, year_to=year_to)

def get_top_clients(
    db: Session,
    *,
    limit: int = 5,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
) -> List[dict]:
    from app.crud import invoice as invoice_crud  # ✅ local import
    return invoice_crud.get_top_clients(db, limit=limit, year_from=year_from, year_to=year_to)
