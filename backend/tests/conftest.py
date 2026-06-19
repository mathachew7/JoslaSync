"""
Shared pytest fixtures.

Integration tests spin up a real PostgreSQL test database (test_invoicedb)
and override FastAPI's get_company_db / get_current_user dependencies so
no JWT is needed during tests.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.database import BaseMaster, BaseTenant, master_engine
from app.db.deps import get_company_db, get_current_user
from app.core.config import settings

# ── Test database ─────────────────────────────────────────────────────────────

TEST_DB_NAME = "test_invoicedb"
TEST_DB_URL  = f"postgresql+psycopg2://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{TEST_DB_NAME}"


@pytest.fixture(scope="session", autouse=True)
def create_test_db():
    """Create the test PostgreSQL database once per test session."""
    with master_engine.connect() as conn:
        conn.execution_options(isolation_level="AUTOCOMMIT")
        try:
            conn.execute(text(f'CREATE DATABASE "{TEST_DB_NAME}"'))
        except Exception:
            pass  # already exists
    yield
    # teardown: drop test DB after all tests
    with master_engine.connect() as conn:
        conn.execution_options(isolation_level="AUTOCOMMIT")
        try:
            conn.execute(text(f'DROP DATABASE "{TEST_DB_NAME}" WITH (FORCE)'))
        except Exception:
            pass


@pytest.fixture(scope="session")
def test_engine(create_test_db):
    engine = create_engine(TEST_DB_URL, future=True, pool_pre_ping=True)
    # Import all tenant models so metadata is complete before create_all
    from app.db.models.tenant import client, company_profile, company_settings, invoice  # noqa
    BaseTenant.metadata.create_all(bind=engine)
    yield engine
    BaseTenant.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def db(test_engine):
    """Provide a rollback-isolated DB session per test."""
    Session = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)
    session = Session()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def api_client(db):
    """FastAPI TestClient with auth + DB dependencies overridden."""
    def _override_db():
        yield db

    def _override_user():
        return {
            "id": "1", "username": "testuser",
            "email": "test@test.com", "role": "admin",
            "db": TEST_DB_NAME,
        }

    app.dependency_overrides[get_company_db]   = _override_db
    app.dependency_overrides[get_current_user] = _override_user
    # base_url must be a host in ALLOWED_HOSTS (TrustedHostMiddleware rejects "testserver")
    with TestClient(app, base_url="http://localhost") as c:
        yield c
    app.dependency_overrides.clear()
