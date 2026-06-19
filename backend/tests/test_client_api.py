"""
Integration tests for the client REST API.
Uses the api_client + db fixtures from conftest.py (real PostgreSQL test DB,
auth/DB dependencies overridden — no JWT needed).
"""
import pytest


VALID_PAYLOAD = dict(
    name="Jane Doe",
    email="jane@acme.com",
    phone="5551234567",
    company="Acme Inc",
    address_line1="123 Main St",
    city="St. Louis",
    state="MO",
    postal_code="63119",
)


# ── CREATE ────────────────────────────────────────────────────────────────────

class TestCreateClient:
    def test_creates_client_and_returns_201(self, api_client):
        res = api_client.post("/api/clients", json=VALID_PAYLOAD)
        assert res.status_code == 201
        body = res.json()
        assert body["name"] == "Jane Doe"
        assert body["id"]

    def test_status_is_always_active_on_create(self, api_client):
        res = api_client.post("/api/clients", json=VALID_PAYLOAD)
        assert res.status_code == 201
        assert res.json()["status"] == "Active"

    def test_create_rejects_missing_name(self, api_client):
        payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "name"}
        res = api_client.post("/api/clients", json=payload)
        assert res.status_code == 422

    def test_create_rejects_missing_email(self, api_client):
        payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "email"}
        res = api_client.post("/api/clients", json=payload)
        assert res.status_code == 422

    def test_create_rejects_invalid_email(self, api_client):
        res = api_client.post("/api/clients", json={**VALID_PAYLOAD, "email": "not-an-email"})
        assert res.status_code == 422

    def test_create_rejects_missing_phone(self, api_client):
        payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "phone"}
        res = api_client.post("/api/clients", json=payload)
        assert res.status_code == 422


# ── READ ──────────────────────────────────────────────────────────────────────

class TestGetClient:
    def test_get_returns_correct_client(self, api_client):
        created = api_client.post("/api/clients", json=VALID_PAYLOAD).json()
        res = api_client.get(f"/api/clients/{created['id']}")
        assert res.status_code == 200
        assert res.json()["id"] == created["id"]

    def test_get_nonexistent_returns_404(self, api_client):
        res = api_client.get("/api/clients/00000000-0000-0000-0000-000000000000")
        assert res.status_code == 404

    def test_list_returns_paginated_result(self, api_client):
        api_client.post("/api/clients", json={**VALID_PAYLOAD, "email": "list1@test.com"})
        api_client.post("/api/clients", json={**VALID_PAYLOAD, "email": "list2@test.com"})
        res = api_client.get("/api/clients?page=1&page_size=50")
        assert res.status_code == 200
        body = res.json()
        assert "data" in body
        assert "meta" in body
        assert body["meta"]["total"] >= 2


# ── UPDATE ────────────────────────────────────────────────────────────────────

class TestUpdateClient:
    def _create(self, api_client, extra=None):
        payload = {**VALID_PAYLOAD, "email": f"update_{id(extra)}@test.com", **(extra or {})}
        return api_client.post("/api/clients", json=payload).json()

    def test_update_name_succeeds(self, api_client):
        c = self._create(api_client)
        res = api_client.put(f"/api/clients/{c['id']}", json={"name": "Updated Name"})
        assert res.status_code == 200
        assert res.json()["name"] == "Updated Name"

    def test_update_with_null_optional_fields_succeeds(self, api_client):
        """Frontend sends null for unfilled optional constrained fields — must be 200."""
        c = self._create(api_client)
        res = api_client.put(f"/api/clients/{c['id']}", json={
            "default_currency": None,
            "country":          None,
            "default_tax_rate": None,
            "discount_rate":    None,
            "payment_terms":    None,
        })
        assert res.status_code == 200

    def test_update_empty_string_for_currency_returns_422(self, api_client):
        """Empty string must be rejected — this was the original bug."""
        c = self._create(api_client)
        res = api_client.put(f"/api/clients/{c['id']}", json={"default_currency": ""})
        assert res.status_code == 422

    def test_update_empty_string_for_country_returns_422(self, api_client):
        c = self._create(api_client)
        res = api_client.put(f"/api/clients/{c['id']}", json={"country": ""})
        assert res.status_code == 422

    def test_update_status_to_deactivated(self, api_client):
        c = self._create(api_client)
        res = api_client.put(f"/api/clients/{c['id']}", json={"status": "Deactivated"})
        assert res.status_code == 200
        assert res.json()["status"] == "Deactivated"

    def test_update_invalid_status_returns_422(self, api_client):
        c = self._create(api_client)
        res = api_client.put(f"/api/clients/{c['id']}", json={"status": "SomethingRandom"})
        assert res.status_code == 422

    def test_update_nonexistent_client_returns_404(self, api_client):
        res = api_client.put(
            "/api/clients/00000000-0000-0000-0000-000000000000",
            json={"name": "Ghost"},
        )
        assert res.status_code == 404


# ── DELETE ────────────────────────────────────────────────────────────────────

class TestDeleteClient:
    def test_delete_returns_204(self, api_client):
        c = api_client.post("/api/clients", json={**VALID_PAYLOAD, "email": "del@test.com"}).json()
        res = api_client.delete(f"/api/clients/{c['id']}")
        assert res.status_code == 204

    def test_deleted_client_returns_404_on_get(self, api_client):
        c = api_client.post("/api/clients", json={**VALID_PAYLOAD, "email": "del2@test.com"}).json()
        api_client.delete(f"/api/clients/{c['id']}")
        res = api_client.get(f"/api/clients/{c['id']}")
        assert res.status_code == 404

    def test_delete_nonexistent_returns_404(self, api_client):
        res = api_client.delete("/api/clients/00000000-0000-0000-0000-000000000000")
        assert res.status_code == 404
