from fastapi import APIRouter, Depends, Query, status, HTTPException
from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.schemas.client import ClientCreate, ClientUpdate, ClientOut, ClientListOut, PageMeta
from app.services.client_service import client_service
from app.db.deps import get_company_db, get_current_user
from app.core.config import settings

router = APIRouter(prefix="/clients", tags=["clients"])

DEFAULT_PAGE_SIZE = 10
MAX_PAGE_SIZE = 100

@router.get("", response_model=ClientListOut)
def list_clients(
    q: Optional[str] = Query(None, description="Search name/email/company"),
    status: Optional[str] = Query(None, description="Active|Deactivated|Blacklisted"),
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    db: Session = Depends(get_company_db),          # ✅ tenant session
    user: dict = Depends(get_current_user),         # ✅ dict from deps.py
):
    uname = user.get("email") or user.get("sub") or "unknown"
    logger.info(f"➡️ GET /clients | user={uname} q={q} status={status} page={page} size={page_size}")
    rows, total = client_service.list(db, q, status, page, page_size)
    logger.info(f"✅ /clients | total={total} returned={len(rows)}")
    return ClientListOut(
        data=[ClientOut.model_validate(r) for r in rows],
        meta=PageMeta(page=page, page_size=page_size, total=total),
    )

@router.get("/{client_id}", response_model=ClientOut)
def get_client(
    client_id: UUID,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    uname = user.get("email") or user.get("sub") or "unknown"
    logger.info(f"➡️ GET /clients/{client_id} | user={uname}")
    obj = client_service.get(db, client_id)
    logger.info(f"✅ /clients/{client_id} | found")
    return ClientOut.model_validate(obj)

@router.post("", status_code=status.HTTP_201_CREATED, response_model=ClientOut)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    uname = user.get("email") or user.get("sub") or "system"
    logger.info(f"➡️ POST /clients | user={uname} name={payload.name} email={payload.email}")
    obj = client_service.create(db, payload, created_by=uname)
    logger.info(f"✅ /clients created | id={obj.id} name={obj.name}")
    return ClientOut.model_validate(obj)

@router.put("/{client_id}", response_model=ClientOut)
def update_client(
    client_id: UUID,
    payload: ClientUpdate,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    uname = user.get("email") or user.get("sub") or "unknown"
    logger.info(f"➡️ PUT /clients/{client_id} | user={uname}")
    obj = client_service.update(db, client_id, payload)
    logger.info(f"✅ /clients/{client_id} updated")
    return ClientOut.model_validate(obj)

@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: UUID,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    uname = user.get("email") or user.get("sub") or "unknown"
    logger.info(f"➡️ DELETE /clients/{client_id} | user={uname}")
    client_service.delete(db, client_id, deleted_by=uname)
    logger.info(f"🗑️ /clients/{client_id} soft-deleted by {uname}")
    return None


# ── Master-only: view deleted clients ────────────────────────────────────────

def _require_master(user: dict):
    db_name = user.get("db_name", "")
    if db_name != settings.MASTER_DB_NAME:
        raise HTTPException(status_code=403, detail="Master access required.")


@router.get("/deleted", response_model=List[ClientOut])
def list_deleted_clients(
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    _require_master(user)
    rows = client_service.list_deleted(db)
    logger.info(f"✅ /clients/deleted | master listed {len(rows)} deleted clients")
    return [ClientOut.model_validate(r) for r in rows]


@router.post("/{client_id}/restore", response_model=ClientOut)
def restore_client(
    client_id: UUID,
    db: Session = Depends(get_company_db),
    user: dict = Depends(get_current_user),
):
    _require_master(user)
    uname = user.get("email") or user.get("sub") or "master"
    logger.info(f"➡️ POST /clients/{client_id}/restore | user={uname}")
    obj = client_service.restore(db, client_id)
    logger.info(f"✅ /clients/{client_id} restored")
    return ClientOut.model_validate(obj)
