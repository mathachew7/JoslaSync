from uuid import UUID
from sqlalchemy.orm import Session
from typing import Optional

from app.core.logger import logger
from app.schemas.client import ClientCreate, ClientUpdate
from app.validators.client_validator import validate_status
from app.repositories.client_repo import client_repo
from app.db.models.tenant.client import Client

class ClientService:
    def list(self, db: Session, q: Optional[str], status: Optional[str], page: int, page_size: int):
        # Normalize and validate status for consistent querying
        if status is not None:
            status = status.strip().title()
            validate_status(status)

        logger.info(f"🔎 client_service.list | q={q} status={status} page={page} size={page_size}")
        rows, total = client_repo.list(db, q, status, page, page_size)
        logger.info(f"📊 client_service.list | total={total} returned={len(rows)}")
        return rows, total

    def get(self, db: Session, client_id: UUID) -> Client:
        logger.info(f"🔎 client_service.get | id={client_id}")
        obj = client_repo.get(db, client_id)
        if not obj:
            logger.warning(f"⚠️ client_service.get | not_found id={client_id}")
            from fastapi import HTTPException, status as st
            raise HTTPException(status_code=st.HTTP_404_NOT_FOUND, detail="Client not found")
        return obj

    def create(self, db: Session, payload: ClientCreate, created_by: str) -> Client:
        logger.info(f"🆕 client_service.create | name={payload.name} email={payload.email} by={created_by}")
        obj = client_repo.create(db, payload, created_by)
        logger.info(f"✅ client_service.create | id={obj.id}")
        return obj

    def update(self, db: Session, client_id: UUID, payload: ClientUpdate) -> Client:
        logger.info(f"✏️ client_service.update | id={client_id}")

        # Normalize and validate status before persisting
        if payload.status is not None:
            logger.info(f"✏️ client_service.update | validate status={payload.status}")
            normalized = payload.status.strip().title()
            validate_status(normalized)
            payload.status = normalized

        obj = self.get(db, client_id)
        obj = client_repo.update(db, obj, payload)
        logger.info(f"✅ client_service.update | id={obj.id}")
        return obj

    def delete(self, db: Session, client_id: UUID) -> None:
        logger.info(f"🗑️ client_service.delete | id={client_id}")
        obj = self.get(db, client_id)
        client_repo.delete(db, obj)
        logger.info(f"✅ client_service.delete | id={client_id}")

client_service = ClientService()
