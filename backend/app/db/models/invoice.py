from sqlalchemy import Column, Integer, String, Float, Date, JSON
from app.db.database import BaseTenant as Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    client_name = Column(String, nullable=False)
    invoice_title = Column(String, nullable=True)
    invoice_date = Column(Date, nullable=False)
    status = Column(String, default="Outstanding")
    line_items = Column(JSON, nullable=False)  # [{"description": "", "quantity": 1, "price": 0}]
    discount = Column(Float, default=0.0)
    tax = Column(Float, default=0.0)
    total = Column(Float, nullable=False)
    notes = Column(String, nullable=True)
