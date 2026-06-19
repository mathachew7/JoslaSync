# app/api/routes/__init__.py
from fastapi import APIRouter

from .auth import router as auth_router
from .admin import router as admin_router
from .clients import router as clients_router
from .company_profile import router as company_profile_router
from .invoice import router as invoice_router
from .company_settings import router as company_settings_router

# ✅ Single /api prefix applied to all included routers
api_router = APIRouter(prefix="/api")

api_router.include_router(auth_router, prefix="/auth", tags=["Auth"])
api_router.include_router(admin_router)
api_router.include_router(clients_router)
api_router.include_router(company_profile_router)
api_router.include_router(invoice_router)
api_router.include_router(company_settings_router)
