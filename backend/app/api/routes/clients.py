from fastapi import APIRouter, Depends, Query, status
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.schemas.client import ClientCreate, ClientUpdate, ClientOut, ClientListOut, PageMeta
from app.services.client_service import client_service
from app.db.deps import get_company_db, get_current_user  # ✅ use your deps

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
    client_service.delete(db, client_id)
    logger.info(f"🗑️ /clients/{client_id} deleted")
    return None
