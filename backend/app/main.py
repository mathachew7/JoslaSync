# app/main.py
from __future__ import annotations

import uuid
import jwt
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

# Optional proxy headers (older Starlette may not have this module)
try:
    from starlette.middleware.proxy_headers import ProxyHeadersMiddleware  # type: ignore
    _HAS_PROXY_HEADERS = True
except Exception:  # ModuleNotFoundError on older Starlette
    ProxyHeadersMiddleware = None  # type: ignore
    _HAS_PROXY_HEADERS = False

from app.api.routes import api_router
from app.core.logger import logger
from app.core.config import settings
from app.db.database import master_engine, BaseMaster
from app.db.models.master.company_profile import CompanyProfile  # noqa: F401


def build_app() -> FastAPI:
    app = FastAPI(
        title="Joslasync API",
        version="1.0.0",
        docs_url="/docs" if getattr(settings, "DEBUG", True) else None,
        redoc_url="/redoc" if getattr(settings, "DEBUG", True) else None,
        openapi_url="/openapi.json" if getattr(settings, "DEBUG", True) else None,
    )

    # ---------- Reverse-proxy awareness (scheme, host, client IP) ----------
    if _HAS_PROXY_HEADERS:
        app.add_middleware(
            ProxyHeadersMiddleware,  # type: ignore
            trusted_hosts=getattr(settings, "ALLOWED_PROXY_IPS", "*"),
        )

    # ---------- Host allowlist (tighten in prod) ----------
    allowed_hosts = getattr(settings, "ALLOWED_HOSTS", ["localhost", "127.0.0.1"])
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

    # ---------- CORS ----------
    cors_origins = getattr(settings, "CORS_ORIGINS", ["http://localhost:5173", "http://127.0.0.1:5173"])
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Accept",
            "X-Requested-With",
            "X-Request-ID",
        ],
        expose_headers=["X-Request-ID"],
        max_age=600,
    )

    # ---------- Static files ----------
    app.mount("/static", StaticFiles(directory="static"), name="static")

    # ---------- Security headers ----------
    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-XSS-Protection", "0")
        response.headers.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=()",
        )
        csp = getattr(settings, "CONTENT_SECURITY_POLICY", None)
        if csp:
            response.headers.setdefault("Content-Security-Policy", csp)
        return response

    # ---------- Request ID & tenant context logging ----------
    @app.middleware("http")
    async def request_id_and_tenant_logger(request: Request, call_next):
        req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        db_name = "unknown"
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            try:
                payload = jwt.decode(
                    auth.split(" ", 1)[1],
                    settings.JWT_SECRET,
                    algorithms=[settings.JWT_ALGORITHM],
                )
                db_name = payload.get("db_name") or payload.get("db") or "unknown"
            except jwt.PyJWTError:
                pass
        logger.info(f"➡️  {request.method} {request.url.path} | db={db_name} | req_id={req_id}")
        response = await call_next(request)
        response.headers["X-Request-ID"] = req_id
        return response

    # ---------- Ensure master schema ----------
    @app.on_event("startup")
    def ensure_master_schema():
        BaseMaster.metadata.create_all(bind=master_engine)
        logger.info("✅ Master DB connected and base models ensured.")

    # ---------- Error handler ----------
    @app.exception_handler(Exception)
    async def all_exceptions(request: Request, exc: Exception):
        logger.exception("Unhandled error")
        if getattr(settings, "DEBUG", True):
            return JSONResponse(status_code=500, content={"detail": str(exc)})
        return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})

    @app.get("/")
    def root():
        return {"message": "Joslasync backend is live"}

    app.include_router(api_router)
    return app


app = build_app()
