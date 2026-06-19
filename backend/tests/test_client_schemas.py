"""
Unit tests for client Pydantic schemas — no database needed.
Covers:
  - ClientCreate always defaults status to Active
  - ClientUpdate rejects empty strings for min-length constrained fields
  - ClientUpdate accepts null for all optional fields
  - Required fields are required on create
"""
import pytest
from pydantic import ValidationError
from app.schemas.client import ClientCreate, ClientUpdate

VALID_CREATE = dict(
    name="Jane Doe",
    email="jane@acme.com",
    phone="5551234567",
)


class TestClientCreate:
    def test_status_defaults_to_active(self):
        c = ClientCreate(**VALID_CREATE)
        assert c.status == "Active"

    def test_status_active_even_if_caller_omits_it(self):
        c = ClientCreate(**VALID_CREATE)
        assert c.status == "Active"

    def test_name_is_required(self):
        with pytest.raises(ValidationError, match="name"):
            ClientCreate(email="x@x.com", phone="1234567890")

    def test_email_is_required(self):
        with pytest.raises(ValidationError, match="email"):
            ClientCreate(name="X", phone="1234567890")

    def test_email_must_be_valid(self):
        with pytest.raises(ValidationError, match="email"):
            ClientCreate(name="X", email="not-an-email", phone="1234567890")

    def test_phone_is_required(self):
        with pytest.raises(ValidationError, match="phone"):
            ClientCreate(name="X", email="x@x.com")

    def test_optional_fields_default_to_none(self):
        c = ClientCreate(**VALID_CREATE)
        assert c.company          is None
        assert c.default_currency is None
        assert c.default_tax_rate is None
        assert c.country          is None
        assert c.notes            is None

    def test_default_tax_rate_rejects_negative(self):
        with pytest.raises(ValidationError):
            ClientCreate(**VALID_CREATE, default_tax_rate=-1)

    def test_default_tax_rate_rejects_over_100(self):
        with pytest.raises(ValidationError):
            ClientCreate(**VALID_CREATE, default_tax_rate=101)


class TestClientUpdate:
    def test_all_fields_optional(self):
        # Empty update payload is valid
        u = ClientUpdate()
        assert u.name is None

    def test_null_accepted_for_currency(self):
        u = ClientUpdate(default_currency=None)
        assert u.default_currency is None

    def test_empty_string_rejected_for_currency(self):
        """Empty string violates min_length=3 on default_currency."""
        with pytest.raises(ValidationError, match="default_currency"):
            ClientUpdate(default_currency="")

    def test_empty_string_rejected_for_country(self):
        """Empty string violates min_length=2 on country."""
        with pytest.raises(ValidationError, match="country"):
            ClientUpdate(country="")

    def test_valid_currency_accepted(self):
        u = ClientUpdate(default_currency="USD")
        assert u.default_currency == "USD"

    def test_valid_country_accepted(self):
        u = ClientUpdate(country="US")
        assert u.country == "US"

    def test_null_accepted_for_country(self):
        u = ClientUpdate(country=None)
        assert u.country is None

    def test_null_accepted_for_all_optional_fields(self):
        u = ClientUpdate(
            default_tax_rate=None,
            discount_rate=None,
            default_currency=None,
            payment_terms=None,
            country=None,
            notes=None,
        )
        assert u.default_tax_rate is None

    def test_status_accepts_valid_values(self):
        for v in ("Active", "Deactivated", "Blacklisted"):
            u = ClientUpdate(status=v)
            assert u.status == v

    def test_status_rejects_invalid_value(self):
        with pytest.raises(ValidationError):
            ClientUpdate(status="Unknown")
