from sqlalchemy import Column, String, Integer, DateTime
from app.db.database import BaseMaster
from datetime import datetime


class Company(BaseMaster):
    """Master-DB registry: one row per tenant company, maps name → tenant db_name."""
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), nullable=False, unique=True)
    db_name = Column(String(255), nullable=False, unique=True)
    status = Column(String(32), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
