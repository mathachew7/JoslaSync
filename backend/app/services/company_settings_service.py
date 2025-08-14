# app/services/company_settings_service.py
from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models.tenant.company_settings import CompanySettings
from app.db.models.tenant.company_profile import CompanyProfile
from app.schemas.company_settings import CompanySettingsUpdate


def _to_float(v, default=0.0):
    try:
        return float(v)
    except Exception:
        return default


def _default_terms_for(legal_name: str) -> str:
    return f"""{legal_name}

These Terms & Conditions govern your use of our services, including software development, website design, brand development, and IT services. By engaging with our services you agree to comply with these Terms & Conditions.

Services: {legal_name} provides software, websites, brand development, and IT services. The scope of services will be outlined in a separate agreement or project proposal.

1. Payment Terms
- Invoices are issued upon project milestones or as agreed.
- Payment is due within 5 days from the invoice date.
- Late payments may incur a 1.5% monthly late fee.

2. Intellectual Property
All intellectual property rights remain with {legal_name} until full payment is received. Upon full payment, rights transfer to the client as per the agreement.

3. Confidentiality
We will keep all client information confidential and will not disclose details without prior written consent, except as required by law.

4. Liability
{legal_name} is not liable for indirect, incidental, or consequential damages from our services. Liability is limited to the amount paid for the service.

5. Termination
Either party may terminate with 30 days written notice. The client agrees to pay for all work completed up to the termination date.

6. Governing Law
These Terms & Conditions are governed by the laws of Missouri, USA. Disputes are subject to the exclusive jurisdiction of Missouri courts.

7. Contact Information
For questions or concerns, contact us at: info@{legal_name.lower().replace(' ', '')}.com

8. Amendments
{legal_name} reserves the right to amend these Terms & Conditions at any time. Clients will be notified of changes.
""".strip()


def get_or_create_settings(db: Session) -> CompanySettings:
    # Return existing
    settings = db.query(CompanySettings).first()
    if settings:
        return settings

    # Seed from tenant CompanyProfile
    profile = db.query(CompanyProfile).first()
    legal_name = (profile.company_name if profile and profile.company_name else "Your Company")

    settings = CompanySettings(
        # Identity / branding
        legal_name=legal_name,
        addr1=(profile.address1 if profile else None),
        addr2=(profile.address2 if profile else None),
        city=(profile.city if profile else None),
        state=(profile.state if profile else None),
        zip=(profile.zip_code if profile else None),
        country="UNITED STATES",
        email=(profile.company_email if profile else None),
        phone=(profile.company_mobile if profile else None),
        logo_url=(profile.logo_url if profile else None),

        # Invoice defaults
        pos_state=(profile.state if profile else None),
        default_tax_rate=_to_float(profile.tax_rate) if profile else 0.0,
        currency_code="USD",
        currency_symbol="$",
        date_format="MM/DD/YYYY",
        number_format="1,234.56",
        invoice_prefix="INV-",
        invoice_number_strategy="prefix-YYYY-####",

        # Theme / terms
        brand_primary_hex="#000033",
        terms_template=_default_terms_for(legal_name),
        terms_version="v1",

        # Display toggles
        show_logo_page1=True,
        show_logo_all_pages=False,
        show_watermark=False,
    )

    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def update_settings(db: Session, data: CompanySettingsUpdate) -> CompanySettings:
    settings = get_or_create_settings(db)
    for field, value in data.dict(exclude_unset=True).items():
        setattr(settings, field, value)
    settings.touch()
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings
