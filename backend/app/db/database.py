# app/db/database.py
from typing import Generator
from functools import lru_cache

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import settings
from app.core.logger import logger

# =======================
# Bases
# =======================
BaseMaster = declarative_base()   # Master metadata
BaseTenant = declarative_base()   # Tenant metadata

# Back-compat aliases
MasterBase = BaseMaster
TenantBase = BaseTenant
Base = BaseTenant  # convention: default Base -> tenant models

# =======================
# Master DB (single)
# =======================
DATABASE_URL = settings.DATABASE_URL  # Prefer postgresql+psycopg2://...
master_engine = create_engine(DATABASE_URL, future=True, pool_pre_ping=True)
MasterSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=master_engine)

def get_db() -> Generator[Session, None, None]:
    db = MasterSessionLocal()
    try:
        yield db
    finally:
        db.close()

# =======================
# Tenant DB helpers
# =======================
def _tenant_url(db_name: str) -> URL:
    """
    Build a tenant DB URL from settings.
    Falls back to MASTER_USERNAME / MASTER_PASSWORD if DB_USER / DB_PASSWORD are not set.
    """
    return URL.create(
        "postgresql+psycopg2",
        username=getattr(settings, "DB_USER", settings.MASTER_USERNAME),
        password=getattr(settings, "DB_PASSWORD", settings.MASTER_PASSWORD),
        host=getattr(settings, "DB_HOST", "localhost"),
        port=getattr(settings, "DB_PORT", 5432),
        database=db_name,
    )

@lru_cache(maxsize=256)
def get_engine_for_db(db_name: str):
    """Cached SQLAlchemy engine per tenant DB name."""
    return create_engine(_tenant_url(db_name), future=True, pool_pre_ping=True)

def get_tenant_session(db_name: str):
    """Preferred sessionmaker for a tenant database (by name)."""
    engine = get_engine_for_db(db_name)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_tenant_database_if_missing(db_name: str):
    """
    Create the tenant DB (by name) using the master connection.
    Safe to call during registration; caller may ignore 'already exists'.
    """
    qname = f'"{db_name}"'
    with master_engine.connect() as conn:
        conn.execution_options(isolation_level="AUTOCOMMIT")
        try:
            conn.execute(text(f"CREATE DATABASE {qname}"))
            logger.info(f"🆕 Created tenant database {db_name}")
        except Exception:
            # likely already exists or insufficient privs — caller may log
            pass

def ensure_tenant_tables(db_name: str):
    """
    Ensure all tenant tables exist in the given tenant DB.
    IMPORTANT: import all tenant models before calling, so BaseTenant.metadata is populated.
    """
    # Import required tenant models that exist in the repo
    from app.db.models.tenant import client as _client  # noqa: F401
    from app.db.models.tenant import company_profile as _company_profile  # noqa: F401
    from app.db.models.tenant import company_settings as _company_settings  # noqa: F401
    # ⛔️ Do NOT import invoice here unless you actually have it.

    engine = get_engine_for_db(db_name)
    BaseTenant.metadata.create_all(bind=engine)
    logger.info(f"✅ Ensured tenant tables for DB '{db_name}'")

# =======================
# Back-compat (URL-based)
# =======================
def get_company_engine(db_url: str):
    """DEPRECATED: prefer get_engine_for_db(db_name)."""
    return create_engine(db_url, future=True, pool_pre_ping=True)

def get_company_session(db_url: str):
    """
    DEPRECATED: prefer get_tenant_session(db_name).
    """
    engine = get_company_engine(db_url)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)
