# app/db/company_session.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

def get_company_session(database_url: str) -> sessionmaker:
    """
    Return a session factory for a specific company/tenant DB.
    Matches project-wide DB settings (future=True, pool_pre_ping=True).
    """
    engine = create_engine(
        database_url,
        future=True,
        pool_pre_ping=True
    )
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Example usage:
# SessionLocal = get_company_session(some_db_url)
# with SessionLocal() as db:
#     ...
