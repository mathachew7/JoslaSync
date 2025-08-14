# app/db/models/tenant/client.py
from sqlalchemy import (
    Column, String, Text, Date, TIMESTAMP, func, Numeric, CHAR,
    CheckConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_mixin
from app.db.database import BaseTenant  # 👈 same as CompanyProfile
import uuid

@declarative_mixin
class TimestampMixin:
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

class Client(BaseTenant, TimestampMixin):  # 👈 inherit BaseTenant directly
    __tablename__ = "clients"
    __table_args__ = (
        CheckConstraint(
            "status IN ('Active','Deactivated','Blacklisted')",
            name="clients_status_chk",
        ),
        Index("idx_clients_name", "name"),
        Index("idx_clients_email", "email"),
        Index("idx_clients_status", "status"),
        Index("idx_clients_joined_date", "joined_date"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Required basics
    name = Column(String(200), nullable=False)
    email = Column(String(254), nullable=False)
    phone = Column(String(32), nullable=False)

    # UI fields
    company = Column(String(200), nullable=True)
    notes = Column(Text, nullable=True)
    joined_date = Column(Date, nullable=True)  # from UI "joined"

    # Future-ready (nullable)
    address_line1 = Column(String(200), nullable=True)
    address_line2 = Column(String(200), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(CHAR(2), nullable=True)
    tax_id = Column(String(50), nullable=True)
    default_currency = Column(CHAR(3), nullable=True)
    default_tax_rate = Column(Numeric(5, 2), nullable=True)
    payment_terms = Column(String(50), nullable=True)
    discount_rate = Column(Numeric(5, 2), nullable=True)

    status = Column(String(20), nullable=False, server_default="Active")
    created_by = Column(String(120), nullable=False)
