import os
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

class Settings(BaseModel):
    # App
    APP_NAME: str = os.getenv("APP_NAME", "joslasync")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # JWT / Auth
    JWT_SECRET: str = os.getenv("JWT_SECRET")
    REFRESH_SECRET: str = os.getenv("REFRESH_SECRET")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

    # Master DB
    MASTER_USERNAME: str = os.getenv("MASTER_USERNAME")
    MASTER_PASSWORD: str = os.getenv("MASTER_PASSWORD")
    MASTER_EMAIL: str = os.getenv("MASTER_EMAIL", "admin@joslasync.com")
    MASTER_DB_NAME: str = os.getenv("MASTER_DB_NAME", "invoicedb")

    # Database URL
    DATABASE_URL: str = os.getenv("DATABASE_URL")

    # Cookies
    REFRESH_COOKIE_NAME: str = os.getenv("REFRESH_COOKIE_NAME", "refresh_token")
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    COOKIE_SAMESITE: str = os.getenv("COOKIE_SAMESITE", "lax")

settings = Settings()
