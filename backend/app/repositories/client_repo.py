from uuid import UUID
from sqlalchemy.orm import Session
from typing import Optional, Tuple, List

from app.schemas.client import ClientCreate, ClientUpdate
from app.db.models.tenant.client import Client
from app.crud import client as crud_client

class ClientRepository:
    def list(self, db: Session, q: Optional[str], status: Optional[str], page: int, page_size: int):
        return crud_client.list_clients(db, q, status, page, page_size)

    def list_deleted(self, db: Session):
        return crud_client.list_deleted_clients(db)

    def get(self, db: Session, client_id: UUID) -> Optional[Client]:
        return crud_client.get_client(db, client_id)

    def get_including_deleted(self, db: Session, client_id: UUID) -> Optional[Client]:
        return crud_client.get_client_including_deleted(db, client_id)

    def create(self, db: Session, payload: ClientCreate, created_by: str) -> Client:
        return crud_client.create_client(db, payload, created_by)

    def update(self, db: Session, db_obj: Client, payload: ClientUpdate) -> Client:
        return crud_client.update_client(db, db_obj, payload)

    def soft_delete(self, db: Session, db_obj: Client, deleted_by: str) -> None:
        crud_client.soft_delete_client(db, db_obj, deleted_by)

    def restore(self, db: Session, client_id: UUID) -> Optional[Client]:
        return crud_client.restore_client(db, client_id)

client_repo = ClientRepository()
