from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from datetime import datetime
from app.db.database import BaseMaster


VALID_FEATURES = {"draft_invoices", "recurring_invoices", "multi_user", "email_reminders"}


class TenantFeature(BaseMaster):
    """Per-tenant feature flag — one row per (company, feature_key)."""
    __tablename__ = "tenant_features"

    id          = Column(Integer, primary_key=True, index=True)
    company_id  = Column(Integer, ForeignKey("companies.id"), nullable=False)
    feature_key = Column(String(50), nullable=False)
    enabled     = Column(Boolean, default=True, nullable=False)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
