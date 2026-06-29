# app/api/routes/company_features.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.db.database import get_db
from app.db.deps import get_current_user
from app.db.models.master.tenant_features import TenantFeature, VALID_FEATURES
from app.schemas.admin import TenantFeaturesOut

router = APIRouter(prefix="/company", tags=["Company Features"])


@router.get("/features", response_model=TenantFeaturesOut)
def get_own_features(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the feature flags enabled for the calling user's company."""
    logger.info(f"➡️ GET /company/features | user={user.get('username')}")
    company_id = user.get("company_id") or user.get("id")
    if not company_id:
        return TenantFeaturesOut()

    rows = db.query(TenantFeature).filter(TenantFeature.company_id == int(company_id)).all()
    existing = {r.feature_key: r.enabled for r in rows}
    flags = {key: existing.get(key, True) for key in VALID_FEATURES}
    return TenantFeaturesOut(**flags)
