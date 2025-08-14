# app/repositories/auth_repo.py
from sqlalchemy.orm import Session
from typing import Optional
from app.core.logger import logger
from app.db.models.user import User
from app.schemas.auth import UserCreate

class AuthRepository:
    def get_user_by_username(self, db: Session, username: str) -> Optional[User]:
        logger.debug(f"🔎 Fetch user by username: {username}")
        return db.query(User).filter(User.username == username).first()

    def create_user(self, db: Session, user: UserCreate, hashed_password: str) -> User:
        logger.debug(f"📝 Create user: {user.username}")
        db_user = User(
            username=user.username,
            email=user.email,
            hashed_password=hashed_password,
            is_active=True,
            company_id=user.company_id,
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        logger.debug(f"✅ User persisted: {db_user.id}")
        return db_user
