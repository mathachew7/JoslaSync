# app/db/models/tenant/invoice.py
from sqlalchemy import (
    Column, String, Text, Date, Boolean, Numeric, Integer,
    ForeignKey, CheckConstraint, Index, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.database import BaseTenant
from app.db.models.tenant.client import TimestampMixin  # reuse your mixin
import uuid


class Invoice(BaseTenant, TimestampMixin):
    """
    Tenant-scoped invoice that stores ONLY references to client/company/user,
    plus pricing inputs, computed totals, and an optional frozen JSON payload
    captured at finalize-time for immutable PDF rendering.
    """
    __tablename__ = "invoices"
    __table_args__ = (
        CheckConstraint(
            "status IN ('DRAFT','INVOICE','VOID')",
            name="invoices_status_chk",
        ),
        CheckConstraint(
            "(discount_type IN ('PERCENT','FLAT')) OR (discount_type IS NULL)",
            name="invoices_discount_type_chk",
        ),
        # Keep invoice_no unique per company (per-tenant issuer)
        UniqueConstraint("company_id", "invoice_no", name="uq_invoices_company_invoice_no"),
        Index("idx_invoices_client_id", "client_id"),
        Index("idx_invoices_status", "status"),
        Index("idx_invoices_invoice_date", "invoice_date"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Human-readable sequence (unique per company)
    invoice_no = Column(String(64), nullable=False)

    # References only (no duplication of client/company/user data)
    company_id = Column(Integer, ForeignKey("company_profile.id"), nullable=True)  # set FK if you have tenant company_profile table
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    created_by_user_id = Column(UUID(as_uuid=True), nullable=True)  # likely from master; just store the UUID

    # Status & dates
    status = Column(String(10), nullable=False, server_default="DRAFT")
    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)
    place_of_supply = Column(String(64), nullable=True)
    invoice_title = Column(String(255), nullable=True)  # blank allowed; renderer hides when empty
    created_by_name = Column(String(255), nullable=True)  # display-only convenience (optional)

    # Pricing inputs (as entered)
    discount_enabled = Column(Boolean, nullable=False, server_default="false")
    discount_type = Column(String(10), nullable=True)  # 'PERCENT' | 'FLAT' | NULL
    discount_value = Column(Numeric(12, 2), nullable=False, server_default="0")
    tax_rate = Column(Numeric(5, 2), nullable=False, server_default="0")  # percent

    # Computed totals (DECIMAL, never float)
    subtotal = Column(Numeric(12, 2), nullable=False, server_default="0")
    discount_amount = Column(Numeric(12, 2), nullable=False, server_default="0")
    tax_amount = Column(Numeric(12, 2), nullable=False, server_default="0")
    total = Column(Numeric(12, 2), nullable=False, server_default="0")

    # Payment tracking
    amount_paid = Column(Numeric(12, 2), nullable=False, server_default="0")

    # Reminder tracking
    last_reminder_sent_at = Column(String(32), nullable=True)  # ISO date string "YYYY-MM-DD"
    reminder_count = Column(Integer, nullable=False, server_default="0")

    # Amendment audit trail
    edit_note = Column(Text, nullable=True)       # reason recorded when a finalized invoice is edited
    last_edited_at = Column(String(32), nullable=True)  # ISO datetime string

    # Text blocks from UI
    footer_message = Column(Text, nullable=True)
    additional_information_raw = Column(Text, nullable=True)

    # Optional: a **frozen** render payload (the exact JSON your PDF uses), set on FINALIZE
    frozen_payload_json = Column(JSONB, nullable=True)
    template_version = Column(String(32), nullable=False, server_default="v1")

    # Relationships
    items = relationship(
        "InvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoiceItem.sno",
        passive_deletes=True,
    )


class InvoiceItem(BaseTenant, TimestampMixin):
    """
    Line items stored separately, referenced by invoice_id.
    """
    __tablename__ = "invoice_items"
    __table_args__ = (
        Index("idx_invoice_items_invoice_id", "invoice_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)

    sno = Column(Integer, nullable=False, server_default="1")
    description = Column(Text, nullable=False)
    quantity = Column(Numeric(12, 2), nullable=False, server_default="0")
    unit_price = Column(Numeric(12, 2), nullable=False, server_default="0")
    # optional denormalized row total (kept null; we can compute on the fly)
    # row_total = Column(Numeric(12, 2), nullable=True)

    invoice = relationship("Invoice", back_populates="items")
