from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String, Text
from app.db.database import BaseTenant as Base  # 👈 match your other tenant models

class CompanySettings(Base):
    __tablename__ = "company_settings"

    id = Column(Integer, primary_key=True, index=True)

    # Identity / branding
    legal_name = Column(String(255), nullable=False, default="Josla Tech LLC")
    addr1 = Column(String(255))
    addr2 = Column(String(255))
    city = Column(String(100))
    state = Column(String(100))
    zip = Column(String(20))
    country = Column(String(100), default="UNITED STATES")
    email = Column(String(255))
    phone = Column(String(50))

    # Invoice defaults
    pos_state = Column(String(100))
    default_tax_rate = Column(Numeric(6, 3), nullable=False, default=0)
    currency_code = Column(String(10), nullable=False, default="USD")
    currency_symbol = Column(String(8), nullable=False, default="$")
    date_format = Column(String(32), nullable=False, default="MM/DD/YYYY")
    number_format = Column(String(32), nullable=False, default="1,234.56")
    invoice_prefix = Column(String(32), nullable=False, default="INV-")
    invoice_number_strategy = Column(String(64), nullable=False, default="prefix-YYYY-####")

    # Theme / brand
    brand_primary_hex = Column(String(7), nullable=False, default="#000033")
    logo_url = Column(Text)
    signature_url = Column(Text)

    # Footer / terms
    footer_text_page1 = Column(Text, default="Terms & Conditions on following page.")
    footer_text_other = Column(Text, default="Thank you for your business.")
    terms_template = Column(Text)
    terms_version = Column(String(32), default="v1")

    # Display toggles
    show_logo_page1 = Column(Boolean, nullable=False, default=True)
    show_logo_all_pages = Column(Boolean, nullable=False, default=False)
    show_watermark = Column(Boolean, nullable=False, default=False)

    # Audit
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
