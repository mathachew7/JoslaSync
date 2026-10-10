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


def _shared_sections(legal_name: str, governing_law: str = "Missouri, USA") -> str:
    return f"""6. Governing Law
These Terms & Conditions are governed by the laws of {governing_law}. Disputes are subject to the exclusive jurisdiction of the courts there.

7. Contact Information
For questions or concerns, contact us at: info@{legal_name.lower().replace(' ', '')}.com

8. Amendments
{legal_name} reserves the right to amend these Terms & Conditions at any time. Clients will be notified of changes."""


def _terms_it_software(legal_name: str) -> str:
    return f"""{legal_name}

These Terms & Conditions govern your use of our services, including software development, website design, and IT services. By engaging with our services you agree to comply with these Terms & Conditions.

Services: {legal_name} provides software development, websites, and IT services. The scope of services will be outlined in a separate agreement or project proposal.

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

{_shared_sections(legal_name)}
""".strip()


def _terms_consulting(legal_name: str) -> str:
    return f"""{legal_name}

These Terms & Conditions govern engagements for consulting and professional advisory services. By engaging with {legal_name} you agree to comply with these Terms & Conditions.

Services: {legal_name} provides consulting, advisory, and professional services. The specific scope and deliverables will be outlined in a separate statement of work.

1. Payment Terms
- Invoices are issued per engagement, milestone, or on a recurring basis as agreed.
- Payment is due within 5 days from the invoice date.
- Late payments may incur a 1.5% monthly late fee.

2. Work Product & Methodology
Deliverables provided to the client may be used for the client's internal business purposes. {legal_name} retains ownership of its underlying methodologies, frameworks, and pre-existing materials used in delivering the engagement.

3. Confidentiality
Both parties agree to keep confidential information disclosed during the engagement private and will not disclose it without prior written consent, except as required by law.

4. Independent Contractor
{legal_name} performs services as an independent contractor. Nothing in this agreement creates an employment, partnership, or joint venture relationship.

5. Liability
{legal_name} is not liable for indirect, incidental, or consequential damages arising from its advice or services. Liability is limited to the amount paid for the engagement.

{_shared_sections(legal_name)}
""".strip()


def _terms_creative_marketing(legal_name: str) -> str:
    return f"""{legal_name}

These Terms & Conditions govern creative, design, and marketing services provided by {legal_name}. By engaging with our services you agree to comply with these Terms & Conditions.

Services: {legal_name} provides design, branding, content, and marketing services. The scope of deliverables will be outlined in a separate agreement or project proposal.

1. Payment Terms
- Invoices are issued upon project milestones or as agreed.
- Payment is due within 5 days from the invoice date.
- Late payments may incur a 1.5% monthly late fee.

2. Revisions
Pricing includes up to two rounds of revisions per deliverable unless otherwise agreed. Additional revision rounds may be billed separately.

3. Intellectual Property & Usage Rights
Final deliverables transfer to the client upon full payment. {legal_name} retains the right to display completed work in its portfolio and marketing materials unless the client requests otherwise in writing.

4. Confidentiality
We will keep all client information confidential and will not disclose details without prior written consent, except as required by law.

5. Liability
{legal_name} is not liable for indirect, incidental, or consequential damages from our services. Liability is limited to the amount paid for the service.

{_shared_sections(legal_name)}
""".strip()


def _terms_retail_ecommerce(legal_name: str) -> str:
    return f"""{legal_name}

These Terms & Conditions govern the sale of goods by {legal_name}. By purchasing from us you agree to comply with these Terms & Conditions.

Products: {legal_name} sells physical and/or digital goods as described at the time of sale.

1. Payment Terms
- Payment is due in full at the time of purchase unless otherwise agreed.
- Prices are subject to change without notice until an order is confirmed.

2. Returns & Refunds
Returns are accepted within 14 days of delivery in original, unused condition unless otherwise stated for a specific product. Refunds are issued to the original payment method once the return is received and inspected.

3. Shipping & Risk of Loss
Risk of loss passes to the buyer upon delivery to the carrier or pickup location. Shipping timelines are estimates and not guaranteed.

4. Warranty
Products are sold as-is except where a specific warranty is stated in writing, or as required by applicable law.

5. Liability
{legal_name} is not liable for indirect, incidental, or consequential damages arising from the use of purchased goods. Liability is limited to the amount paid for the product.

{_shared_sections(legal_name)}
""".strip()


def _terms_construction_trades(legal_name: str) -> str:
    return f"""{legal_name}

These Terms & Conditions govern construction, contracting, and trade services provided by {legal_name}. By engaging our services you agree to comply with these Terms & Conditions.

Services: {legal_name} provides construction, renovation, and/or trade services. The specific scope of work will be outlined in a separate agreement or proposal.

1. Payment Terms
- A deposit may be required before work begins, with progress payments due at agreed milestones.
- Final payment is due within 5 days of project completion.
- Late payments may incur a 1.5% monthly late fee.

2. Change Orders
Any changes to the agreed scope of work must be documented in a written change order, which may adjust the price and/or timeline.

3. Site Access & Safety
The client is responsible for providing safe and timely access to the work site unless otherwise agreed in writing.

4. Lien Rights
{legal_name} reserves all rights available under applicable mechanic's lien or construction lien law with respect to unpaid work.

5. Liability
{legal_name} is not liable for indirect, incidental, or consequential damages from our services. Liability is limited to the amount paid for the work performed.

{_shared_sections(legal_name)}
""".strip()


def _terms_general_other(legal_name: str) -> str:
    return f"""{legal_name}

These Terms & Conditions govern services provided by {legal_name}. By engaging with our services you agree to comply with these Terms & Conditions.

Services: The scope of services will be outlined in a separate agreement, proposal, or invoice.

1. Payment Terms
- Invoices are issued as agreed.
- Payment is due within 5 days from the invoice date.
- Late payments may incur a 1.5% monthly late fee.

2. Confidentiality
We will keep all client information confidential and will not disclose details without prior written consent, except as required by law.

3. Liability
{legal_name} is not liable for indirect, incidental, or consequential damages from our services. Liability is limited to the amount paid for the service.

4. Termination
Either party may terminate with 30 days written notice. The client agrees to pay for all work completed up to the termination date.

{_shared_sections(legal_name)}
""".strip()


_TEMPLATES_BY_TYPE = {
    "IT_SOFTWARE": _terms_it_software,
    "CONSULTING": _terms_consulting,
    "CREATIVE_MARKETING": _terms_creative_marketing,
    "RETAIL_ECOMMERCE": _terms_retail_ecommerce,
    "CONSTRUCTION_TRADES": _terms_construction_trades,
    "GENERAL_OTHER": _terms_general_other,
}


def _default_terms_for(legal_name: str, company_type: str | None = None) -> str:
    builder = _TEMPLATES_BY_TYPE.get(company_type or "", _terms_general_other)
    return builder(legal_name)


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
    update_dict = data.dict(exclude_unset=True)

    new_type = update_dict.get("company_type")
    if new_type and new_type != settings.company_type:
        # Company type just changed (including being set for the first time) —
        # regenerate the T&C to match, so onboarding's "pick a type, see matching
        # legal text" flow works. A later unrelated edit that doesn't touch
        # company_type won't clobber any manual customization made since.
        name = update_dict.get("legal_name", settings.legal_name)
        update_dict["terms_template"] = _default_terms_for(name, new_type)

    for field, value in update_dict.items():
        setattr(settings, field, value)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings
