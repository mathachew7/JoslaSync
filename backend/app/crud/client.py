from typing import Optional, Tuple, List
from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_
from uuid import UUID

from app.db.models.tenant.client import Client
from app.schemas.client import ClientCreate, ClientUpdate

def list_clients(
    db: Session,
    q: Optional[str],
    status: Optional[str],
    page: int,
    page_size: int,
) -> Tuple[List[Client], int]:
    stmt = select(Client)
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

def get_client(db: Session, client_id: UUID) -> Optional[Client]:
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

def delete_client(db: Session, db_obj: Client) -> None:
    db.delete(db_obj)
    db.commit()
