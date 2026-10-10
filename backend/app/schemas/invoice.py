# app/schemas/invoice.py
from typing import List, Optional
from datetime import date, datetime
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, condecimal, field_validator
from enum import Enum

# --- enums ---
class InvoiceStatus(str, Enum):
    INVOICE = "INVOICE"
    VOID = "VOID"
    DRAFT = "DRAFT"
    QUOTE = "QUOTE"

class DiscountType(str, Enum):
    PERCENT = "PERCENT"
    FLAT = "FLAT"

# --- line items ---
class InvoiceItemCreate(BaseModel):
    sno: int = 1
    description: str
    quantity: condecimal(max_digits=12, decimal_places=2) = Decimal("0")
    unit_price: condecimal(max_digits=12, decimal_places=2) = Decimal("0")

class InvoiceItemRead(InvoiceItemCreate):
    id: int
    class Config:
        from_attributes = True

# --- create: finalize immediately (no drafts stored on create) ---
class InvoiceCreate(BaseModel):
    # references (no duplication)
    client_id: UUID
    company_id: Optional[int] = None  # <-- INT to match company_profile.id
    status: InvoiceStatus = InvoiceStatus.DRAFT  # default to draft; use INVOICE to finalize on create

    # dates & display
    invoice_date: date
    due_date: Optional[date] = None
    place_of_supply: Optional[str] = None
    invoice_title: Optional[str] = None  # blank allowed (renderer hides)

    # pricing inputs
    discount_enabled: bool = False
    discount_type: Optional[DiscountType] = None
    discount_value: condecimal(max_digits=12, decimal_places=2) = Decimal("0")
    tax_rate: condecimal(max_digits=5, decimal_places=2) = Decimal("0")

    # text blocks
    footer_message: Optional[str] = None
    additional_information_raw: Optional[str] = None

    # items (required; we finalize on create)
    items: List[InvoiceItemCreate]

    # creator (references only; name is optional convenience)
    created_by_user_id: Optional[str] = None
    created_by_name: Optional[str] = None

    # amendment audit — required when editing a finalized INVOICE
    edit_note: Optional[str] = None

    @field_validator("discount_type")
    @classmethod
    def _require_discount_type_if_enabled(cls, v, info):
        values = info.data
        if values.get("discount_enabled") and v is None:
            raise ValueError("discount_type is required when discount_enabled is true")
        return v

# --- read model (what the API returns) ---
class InvoiceRead(BaseModel):
    id: UUID
    invoice_no: str
    status: InvoiceStatus  # INVOICE | VOID | DRAFT | QUOTE

    # references
    client_id: UUID
    company_id: Optional[int]  # <-- INT to match company_profile.id
    created_by_user_id: Optional[str]
    created_by_name: Optional[str]

    # dates & display
    invoice_date: date
    due_date: Optional[date]
    place_of_supply: Optional[str]
    invoice_title: Optional[str]

    # pricing inputs (as stored)
    discount_enabled: bool
    discount_type: Optional[DiscountType]
    discount_value: condecimal(max_digits=12, decimal_places=2)
    tax_rate: condecimal(max_digits=5, decimal_places=2)

    # computed totals
    subtotal: condecimal(max_digits=12, decimal_places=2)
    discount_amount: condecimal(max_digits=12, decimal_places=2)
    tax_amount: condecimal(max_digits=12, decimal_places=2)
    total: condecimal(max_digits=12, decimal_places=2)

    # payment tracking
    amount_paid: condecimal(max_digits=12, decimal_places=2) = Decimal("0")

    # reminder tracking
    last_reminder_sent_at: Optional[str] = None
    reminder_count: int = 0

    # text blocks
    footer_message: Optional[str]
    additional_information_raw: Optional[str]

    # amendment audit
    edit_note: Optional[str] = None
    last_edited_at: Optional[str] = None

    # timestamps
    created_at: datetime
    updated_at: datetime

    # items
    items: List[InvoiceItemRead] = []

    class Config:
        from_attributes = True

# --- updates: only allow voiding (no content edits after issue) ---
class InvoiceVoidRequest(BaseModel):
    reason: Optional[str] = None

# --- analytics & pagination DTOs ---
class InvoiceStats(BaseModel):
    # counts
    total: int
    paid: int           # fully paid invoices
    outstanding: int    # unpaid, not yet overdue
    overdue: int        # unpaid, past due date
    draft: int = 0

    # dollar amounts
    total_invoiced: float = 0.0    # sum of total for all INVOICE status
    total_collected: float = 0.0   # sum of amount_paid for INVOICE status
    outstanding_amount: float = 0.0
    overdue_amount: float = 0.0

class MonthlyTotalsRow(BaseModel):
    month: str           # "Jan", "Feb", ...
    Paid: float
    Outstanding: float
    Overdue: float

class TopClientRow(BaseModel):
    client: str
    Paid: float
    Outstanding: float
    Overdue: float
    Total: float

class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    pages: int

class InvoiceListResponse(BaseModel):
    data: List[InvoiceRead]
    meta: PaginationMeta

class PaymentRequest(BaseModel):
    amount: condecimal(max_digits=12, decimal_places=2, gt=Decimal("0"))
    note: Optional[str] = None

class PaymentAdjustRequest(BaseModel):
    amount_paid: condecimal(max_digits=12, decimal_places=2, ge=Decimal("0"))
    note: Optional[str] = None

class PaymentOut(BaseModel):
    id: UUID
    invoice_id: UUID
    amount: Decimal
    kind: str          # PAYMENT | CORRECTION
    status: str         # ACTIVE | VOID
    note: Optional[str] = None
    recorded_by: Optional[str] = None
    created_at: datetime
    voided_at: Optional[str] = None
    voided_by: Optional[str] = None

    model_config = {"from_attributes": True}

class SendInvoiceRequest(BaseModel):
    to_email: str
    to_name: str = "Customer"
    pdf_base64: str        # base64-encoded PDF bytes (no data: prefix)
    pdf_filename: str = "invoice.pdf"
