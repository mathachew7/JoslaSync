# app/utils/db_utils.py
import sqlalchemy
from app.core.logger import logger
from app.db.database import master_engine

def create_company_database(db_name: str):
    with master_engine.connect() as conn:
        conn.execution_options(isolation_level="AUTOCOMMIT").execute(
            sqlalchemy.text(f'CREATE DATABASE "{db_name}"')
        )
    logger.info(f"Database '{db_name}' created successfully.")
