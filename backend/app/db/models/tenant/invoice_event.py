from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.database import BaseTenant


class InvoiceEvent(BaseTenant):
    __tablename__ = "invoice_events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)  # created|issued|voided|cloned|payment|emailed|amended|accepted
    description = Column(Text, nullable=True)
    created_by = Column(String(120), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
