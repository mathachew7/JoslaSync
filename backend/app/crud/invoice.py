from sqlalchemy.orm import Session
from app.db.models.invoice import Invoice
from app.schemas.invoice import InvoiceCreate

def create_invoice(db: Session, invoice_data: InvoiceCreate):
    db_invoice = Invoice(**invoice_data.dict())
    db.add(db_invoice)
    db.commit()
    db.refresh(db_invoice)
    return db_invoice

def get_invoice(db: Session, invoice_id: int):
    return db.query(Invoice).filter(Invoice.id == invoice_id).first()

def get_all_invoices(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Invoice).offset(skip).limit(limit).all()
