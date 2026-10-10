# app/api/routes/admin.py
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.db.database import get_db
from app.db.deps import require_super_admin
from app.schemas.admin import (
    TenantCreate, TenantRead, TenantStatusUpdate, AdminStats, ResetPasswordResponse,
    FeatureFlagUpdate, TenantFeaturesOut, TenantNameUpdate, AddTenantUserRequest,
)
from app.services.admin_service import AdminService

router = APIRouter(prefix="/admin", tags=["Admin"])
service = AdminService()


@router.post("/users/{user_id}/reset-password", response_model=ResetPasswordResponse)
def reset_user_password(
    user_id: int,
    _: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    logger.info(f"➡️ POST /admin/users/{user_id}/reset-password")
    return service.reset_user_password(user_id, db)


@router.get("/stats", response_model=AdminStats)
def get_stats(
    _: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    logger.info("➡️ GET /admin/stats")
    return service.get_stats(db)


@router.get("/tenants", response_model=List[TenantRead])
def list_tenants(
    include_archived: bool = False,
    _: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    logger.info(f"➡️ GET /admin/tenants | include_archived={include_archived}")
    return service.list_tenants(db, include_archived=include_archived)


@router.post("/tenants", response_model=TenantRead, status_code=201)
def create_tenant(
    body: TenantCreate,
    _: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    logger.info(f"➡️ POST /admin/tenants | company={body.company_name}")
    return service.create_tenant(body, db)


@router.get("/tenants/{company_id}", response_model=TenantRead)
def get_tenant(
    company_id: int,
    _: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    logger.info(f"➡️ GET /admin/tenants/{company_id}")
    return service.get_tenant_detail(company_id, db)


@router.put("/tenants/{company_id}/status", response_model=TenantRead)
def update_tenant_status(
    company_id: int,
    body: TenantStatusUpdate,
    _: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    logger.info(f"➡️ PUT /admin/tenants/{company_id}/status | status={body.status}")
    return service.update_tenant_status(company_id, body.status, db)


@router.put("/tenants/{company_id}", response_model=TenantRead)
def update_tenant_name(
    company_id: int,
    body: TenantNameUpdate,
    _: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    logger.info(f"➡️ PUT /admin/tenants/{company_id} | company_name={body.company_name}")
    return service.update_tenant_name(company_id, body.company_name, db)


@router.post("/tenants/{company_id}/users", response_model=TenantRead, status_code=201)
def add_tenant_user(
    company_id: int,
    body: AddTenantUserRequest,
    _: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    logger.info(f"➡️ POST /admin/tenants/{company_id}/users | id={body.username_or_email}")
    return service.add_tenant_user(company_id, body.username_or_email, body.temp_password, db)


@router.get("/tenants/{company_id}/features", response_model=TenantFeaturesOut)
def get_tenant_features(
    company_id: int,
    _: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    logger.info(f"➡️ GET /admin/tenants/{company_id}/features")
    return service.get_tenant_features(company_id, db)


@router.put("/tenants/{company_id}/features", response_model=TenantFeaturesOut)
def update_tenant_feature(
    company_id: int,
    body: FeatureFlagUpdate,
    _: dict = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    logger.info(f"➡️ PUT /admin/tenants/{company_id}/features | key={body.feature_key} enabled={body.enabled}")
    return service.update_tenant_feature(company_id, body.feature_key, body.enabled, db)
