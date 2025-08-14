from sqlalchemy import Column, String, Integer, DateTime
from app.db.database import BaseTenant
from datetime import datetime

class CompanyProfile(BaseTenant):  # 👈 this is for tenant DB
    __tablename__ = "company_profile"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=False)
    company_email = Column(String, nullable=False)
    company_mobile = Column(String, nullable=False)
    logo_url = Column(String)
    address1 = Column(String)
    address2 = Column(String)
    city = Column(String)
    state = Column(String)
    zip_code = Column(String)
    tax_rate = Column(String)
    status = Column(String, default="active")
    db_name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
