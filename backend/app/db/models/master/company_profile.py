from sqlalchemy import Column, String, Integer, DateTime
from app.db.database import BaseMaster  # <-- changed here
from datetime import datetime

class CompanyProfile(BaseMaster):  # <-- changed here
    __tablename__ = "company_profile"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=False)
    db_name = Column(String, nullable=False, unique=True)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
