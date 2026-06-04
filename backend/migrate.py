"""
Run this script whenever you add new columns to tenant models.
It applies ALTER TABLE to all existing tenant databases.

Usage:
  cd backend
  source venv/bin/activate
  python migrate.py
"""
import sys
from sqlalchemy import create_engine, text
from app.core.config import settings
from app.db.database import master_engine

TENANT_MIGRATIONS = [
    # invoices table
    "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0",
    "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_reminder_sent_at VARCHAR(32)",
    "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0",
    # company_settings table
    "ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS reminder_frequency_days INTEGER NOT NULL DEFAULT 7",
    "ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS reminder_max_count INTEGER NOT NULL DEFAULT 3",
]


def get_tenant_dbs():
    with master_engine.connect() as conn:
        rows = conn.execute(text("SELECT db_name FROM company_profile")).fetchall()
        return [r[0] for r in rows if r[0]]


def migrate_tenant(db_name: str):
    url = f"postgresql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{db_name}"
    engine = create_engine(url)
    with engine.connect() as conn:
        for sql in TENANT_MIGRATIONS:
            conn.execute(text(sql))
            print(f"  ✅ {sql[:70]}…")
        conn.commit()


if __name__ == "__main__":
    dbs = get_tenant_dbs()
    if not dbs:
        print("No tenant databases found.")
        sys.exit(0)

    print(f"Found {len(dbs)} tenant DB(s): {dbs}")
    for db in dbs:
        print(f"\n→ Migrating {db}…")
        try:
            migrate_tenant(db)
        except Exception as e:
            print(f"  ❌ Failed: {e}")

    print("\nDone.")
