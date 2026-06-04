import os
from typing import List
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()


def _list(env_key: str, default: str) -> List[str]:
    raw = os.getenv(env_key, default)
    return [s.strip() for s in raw.split(",") if s.strip()]


class Settings(BaseModel):
    APP_NAME: str = os.getenv("APP_NAME", "joslasync")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("ENVIRONMENT", "development") == "development"

    # JWT / Auth
    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    REFRESH_SECRET: str = os.getenv("REFRESH_SECRET", "")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

    # Master app login credentials
    MASTER_USERNAME: str = os.getenv("MASTER_USERNAME", "")
    MASTER_PASSWORD: str = os.getenv("MASTER_PASSWORD", "")
    MASTER_EMAIL: str = os.getenv("MASTER_EMAIL", "admin@joslasync.com")
    MASTER_DB_NAME: str = os.getenv("MASTER_DB_NAME", "invoicedb")

    # PostgreSQL connection (separate from app login)
    DB_USER: str = os.getenv("DB_USER", "admin")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "secret")
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "5432"))
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # Cookies
    REFRESH_COOKIE_NAME: str = os.getenv("REFRESH_COOKIE_NAME", "refresh_token")
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    COOKIE_SAMESITE: str = os.getenv("COOKIE_SAMESITE", "lax")

    # SMTP / Email
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASS: str = os.getenv("SMTP_PASS", "")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "")
    EMAIL_FROM_NAME: str = os.getenv("EMAIL_FROM_NAME", "JoslaSync")

    # Network / security
    ALLOWED_HOSTS: List[str] = _list(
        "ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0"
    )
    CORS_ORIGINS: List[str] = _list(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    )
    CONTENT_SECURITY_POLICY: str = os.getenv("CONTENT_SECURITY_POLICY", "")


settings = Settings()
