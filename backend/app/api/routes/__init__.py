# app/api/routes/__init__.py
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import get_db

from .auth import router as auth_router
from .admin import router as admin_router
from .clients import router as clients_router
from .company_profile import router as company_profile_router
from .invoice import router as invoice_router
from .company_settings import router as company_settings_router
from .company_features import router as company_features_router

# ✅ Single /api prefix applied to all included routers
api_router = APIRouter(prefix="/api")

_started_at = datetime.now(timezone.utc)

_VERSION_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "..", "VERSION")
try:
    with open(_VERSION_FILE) as f:
        _VERSION = f.read().strip()
except OSError:
    _VERSION = "unknown"


@api_router.get("/health", tags=["Health"])
def health(db: Session = Depends(get_db)):
    """Public, unauthenticated — live reachability check for the status page / login indicator."""
    now = datetime.now(timezone.utc)

    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "down"

    components = [
        {"name": "API", "status": "ok"},
        {"name": "Database", "status": db_status},
    ]
    overall = "ok" if all(c["status"] == "ok" for c in components) else "degraded"

    return {
        "status": overall,
        "components": components,
        "time": now.isoformat(),
        "started_at": _started_at.isoformat(),
        "uptime_seconds": int((now - _started_at).total_seconds()),
        "version": _VERSION,
    }


api_router.include_router(auth_router, prefix="/auth", tags=["Auth"])
api_router.include_router(admin_router)
api_router.include_router(clients_router)
api_router.include_router(company_profile_router)
api_router.include_router(invoice_router)
api_router.include_router(company_settings_router)
api_router.include_router(company_features_router)
