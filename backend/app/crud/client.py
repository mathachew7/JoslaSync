from typing import Optional, Tuple, List
from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from uuid import UUID
from datetime import datetime, timezone

from app.db.models.tenant.client import Client
from app.schemas.client import ClientCreate, ClientUpdate


def list_clients(
    db: Session,
    q: Optional[str],
    status: Optional[str],
    page: int,
    page_size: int,
) -> Tuple[List[Client], int]:
    stmt = select(Client).where(Client.deleted_at.is_(None))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(Client.name.ilike(like), Client.email.ilike(like), Client.company.ilike(like))
        )
    if status:
        stmt = stmt.where(Client.status == status)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    stmt = stmt.order_by(Client.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = db.execute(stmt).scalars().all()
    return rows, total


def list_deleted_clients(db: Session) -> List[Client]:
    stmt = select(Client).where(Client.deleted_at.is_not(None)).order_by(Client.deleted_at.desc())
    return db.execute(stmt).scalars().all()


def get_client(db: Session, client_id: UUID) -> Optional[Client]:
    obj = db.get(Client, client_id)
    if obj and obj.deleted_at is not None:
        return None  # treat soft-deleted as not found for normal lookups
    return obj


def get_client_including_deleted(db: Session, client_id: UUID) -> Optional[Client]:
    return db.get(Client, client_id)


def create_client(db: Session, payload: ClientCreate, created_by: str) -> Client:
    obj = Client(**payload.model_dump(exclude_unset=True), created_by=created_by)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update_client(db: Session, db_obj: Client, payload: ClientUpdate) -> Client:
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(db_obj, k, v)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def soft_delete_client(db: Session, db_obj: Client, deleted_by: str) -> None:
    db_obj.deleted_at = datetime.now(timezone.utc)
    db_obj.deleted_by = deleted_by
    db.add(db_obj)
    db.commit()


def restore_client(db: Session, client_id: UUID) -> Optional[Client]:
    obj = db.get(Client, client_id)
    if not obj or obj.deleted_at is None:
        return None
    obj.deleted_at = None
    obj.deleted_by = None
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj
