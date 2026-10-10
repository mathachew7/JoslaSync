# app/db/models/tenant/payment.py
from sqlalchemy import Column, String, Text, Numeric, Integer, ForeignKey, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from app.db.database import BaseTenant
from app.db.models.tenant.client import TimestampMixin
import uuid


class Payment(BaseTenant, TimestampMixin):
    """
    Ledger of individual payment transactions recorded against an invoice.
    invoice.amount_paid is kept as a denormalized cache, always recomputed
    as SUM(amount) over this table's ACTIVE rows for that invoice.

    A "Correct" action inserts a signed delta row (kind='CORRECTION') rather
    than overwriting history, so every change to amount_paid stays auditable.
    Voiding a row excludes it from the sum without deleting it.
    """
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("status IN ('ACTIVE','VOID')", name="payments_status_chk"),
        CheckConstraint("kind IN ('PAYMENT','CORRECTION')", name="payments_kind_chk"),
        Index("idx_payments_invoice_id", "invoice_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)

    amount = Column(Numeric(12, 2), nullable=False)  # signed; negative for correction decreases
    kind = Column(String(10), nullable=False, server_default="PAYMENT")  # PAYMENT | CORRECTION
    note = Column(Text, nullable=True)
    recorded_by = Column(String(120), nullable=True)

    status = Column(String(10), nullable=False, server_default="ACTIVE")  # ACTIVE | VOID
    voided_at = Column(String(32), nullable=True)  # ISO datetime string
    voided_by = Column(String(120), nullable=True)
