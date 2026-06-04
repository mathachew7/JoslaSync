from __future__ import annotations

import uuid
import jwt
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

try:
    from starlette.middleware.proxy_headers import ProxyHeadersMiddleware  # type: ignore
    _HAS_PROXY_HEADERS = True
except Exception:
    ProxyHeadersMiddleware = None  # type: ignore
    _HAS_PROXY_HEADERS = False

from app.api.routes import api_router
from app.core.logger import logger
from app.core.config import settings
from app.db.database import master_engine, BaseMaster, ensure_tenant_tables
from app.db.models.master.company_profile import Company  # noqa: F401  registers in BaseMaster
from app.db.models.user import User  # noqa: F401


_WEAK_SECRETS = {"your_main_jwt_secret", "your_refresh_secret", "secret", "changeme", ""}


def _warn_weak_secrets() -> None:
    if settings.JWT_SECRET in _WEAK_SECRETS:
        logger.warning("⚠️  JWT_SECRET is a placeholder — replace it before going to production!")
    if settings.REFRESH_SECRET in _WEAK_SECRETS:
        logger.warning("⚠️  REFRESH_SECRET is a placeholder — replace it before going to production!")


def _seed_master_company_profile() -> None:
    """Ensure master's tenant workspace (invoicedb) has a default company_profile row."""
    from app.db.database import get_tenant_session
    from app.db.models.tenant.company_profile import CompanyProfile as TenantProfile

    db_name = settings.MASTER_DB_NAME
    Session = get_tenant_session(db_name)
    db = Session()
    try:
        if not db.query(TenantProfile).first():
            db.add(TenantProfile(
                company_name="Joslasync",
                company_email=settings.MASTER_EMAIL,
                company_mobile="0000000000",
                full_name="Admin",
                address1="",
                address2="",
                city="",
                state="",
                zip_code="00000",
                tax_rate="0",
                status="active",
                db_name=db_name,
            ))
            db.commit()
            logger.info("✅ Master company profile seeded in tenant schema.")
    except Exception as exc:
        db.rollback()
        logger.warning(f"⚠️ Could not seed master company profile: {exc}")
    finally:
        db.close()


def build_app() -> FastAPI:
    app = FastAPI(
        title="Joslasync API",
        version="1.0.0",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        openapi_url="/openapi.json" if settings.DEBUG else None,
    )

    if _HAS_PROXY_HEADERS:
        app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")  # type: ignore

    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.ALLOWED_HOSTS,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
        max_age=600,
    )

    app.mount("/static", StaticFiles(directory="static"), name="static")

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-XSS-Protection", "0")
        if not settings.DEBUG:
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"
            )
        csp = settings.CONTENT_SECURITY_POLICY
        if csp:
            response.headers.setdefault("Content-Security-Policy", csp)
        return response

    @app.middleware("http")
    async def request_id_logger(request: Request, call_next):
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

    @app.on_event("startup")
    def on_startup():
        _warn_weak_secrets()
        # 1. Create master tables (companies, users)
        BaseMaster.metadata.create_all(bind=master_engine)
        logger.info("✅ Master schema ready.")
        # 2. Create tenant tables in master DB so master account can use all features
        try:
            ensure_tenant_tables(settings.MASTER_DB_NAME)
        except Exception as exc:
            logger.warning(f"⚠️ ensure_tenant_tables({settings.MASTER_DB_NAME}): {exc}")
        # 3. Seed master company profile if missing
        _seed_master_company_profile()

    @app.exception_handler(Exception)
    async def all_exceptions(request: Request, exc: Exception):
        logger.exception("Unhandled error")
        if settings.DEBUG:
            return JSONResponse(status_code=500, content={"detail": str(exc)})
        return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})

    @app.get("/")
    def root():
        return {"status": "ok", "service": "Joslasync API"}

    app.include_router(api_router)
    return app


app = build_app()
