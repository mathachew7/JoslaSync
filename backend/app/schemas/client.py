# app/schemas/client.py
from typing import Optional, List, Literal
from datetime import date, datetime
from pydantic import BaseModel, Field, EmailStr, constr
from uuid import UUID
from app.constants.client import CLIENT_STATUSES

# Build a Literal type from the shared list
StatusType = Literal[tuple(CLIENT_STATUSES)]  # type: ignore[misc]

class ClientBase(BaseModel):
    name: constr(strip_whitespace=True, max_length=200)
    email: EmailStr
    phone: constr(strip_whitespace=True, max_length=32)
    company: Optional[constr(max_length=200)] = None
    notes: Optional[str] = None
    joined_date: Optional[date] = None

    address_line1: Optional[constr(max_length=200)] = None
    address_line2: Optional[constr(max_length=200)] = None
    city: Optional[constr(max_length=100)] = None
    state: Optional[constr(max_length=100)] = None
    postal_code: Optional[constr(max_length=20)] = None
    country: Optional[constr(min_length=2, max_length=2)] = None
    tax_id: Optional[constr(max_length=50)] = None
    default_currency: Optional[constr(min_length=3, max_length=3)] = None
    default_tax_rate: Optional[float] = Field(None, ge=0, le=100)
    payment_terms: Optional[constr(max_length=50)] = None
    discount_rate: Optional[float] = Field(None, ge=0, le=100)

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    name: Optional[constr(strip_whitespace=True, max_length=200)] = None
    email: Optional[EmailStr] = None
    phone: Optional[constr(strip_whitespace=True, max_length=32)] = None
    company: Optional[constr(max_length=200)] = None
    notes: Optional[str] = None
    joined_date: Optional[date] = None

    address_line1: Optional[constr(max_length=200)] = None
    address_line2: Optional[constr(max_length=200)] = None
    city: Optional[constr(max_length=100)] = None
    state: Optional[constr(max_length=100)] = None
    postal_code: Optional[constr(max_length=20)] = None
    country: Optional[constr(min_length=2, max_length=2)] = None
    tax_id: Optional[constr(max_length=50)] = None
    default_currency: Optional[constr(min_length=3, max_length=3)] = None
    default_tax_rate: Optional[float] = Field(None, ge=0, le=100)
    payment_terms: Optional[constr(max_length=50)] = None
    discount_rate: Optional[float] = Field(None, ge=0, le=100)
    status: Optional[StatusType] = None

class ClientOut(ClientBase):
    id: UUID
    status: StatusType
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int

class ClientListOut(BaseModel):
    data: List[ClientOut]
    meta: PageMeta
