from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class LineItem(BaseModel):
    description: str
    quantity: int
    price: float

class InvoiceBase(BaseModel):
    client_name: str
    invoice_title: Optional[str] = None
    invoice_date: date
    status: Optional[str] = "Outstanding"
    line_items: List[LineItem]
    discount: Optional[float] = 0.0
    tax: Optional[float] = 0.0
    total: float
    notes: Optional[str] = None

class InvoiceCreate(InvoiceBase):
    pass

class InvoiceRead(InvoiceBase):
    id: int

    class Config:
        orm_mode = True
