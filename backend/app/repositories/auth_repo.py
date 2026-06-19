# app/repositories/auth_repo.py
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.logger import logger
from app.db.models.user import User
from app.schemas.auth import UserCreate

JOSLATECH_DOMAIN = "@joslatech.com"


class AuthRepository:
    def get_user_by_username(self, db: Session, username: str) -> Optional[User]:
        logger.debug(f"🔎 Fetch user by username: {username}")
        return db.query(User).filter(User.username == username).first()

    def get_user_by_email(self, db: Session, email: str) -> Optional[User]:
        logger.debug(f"🔎 Fetch user by email: {email}")
        return db.query(User).filter(User.email == email).first()

    def get_user_by_login(self, db: Session, identifier: str) -> Optional[User]:
        """Resolve by email if identifier contains @, otherwise by username."""
        if "@" in identifier:
            return self.get_user_by_email(db, identifier)
        return self.get_user_by_username(db, identifier)

    def get_user_by_id(self, db: Session, user_id: int) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    def get_users_by_company_id(self, db: Session, company_id: int) -> List[User]:
        return db.query(User).filter(User.company_id == company_id).all()

    def get_all_users(self, db: Session) -> List[User]:
        return db.query(User).all()

    def create_user(self, db: Session, user: UserCreate, hashed_password: str, company_id: Optional[int] = None) -> User:
        logger.debug(f"📝 Create user: {user.username}")
        role = "super_admin" if user.email.endswith(JOSLATECH_DOMAIN) else "tenant_admin"
        db_user = User(
            username=user.username,
            email=user.email,
            hashed_password=hashed_password,
            is_active=True,
            role=role,
            company_id=company_id,
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        logger.debug(f"✅ User persisted: {db_user.id} role={role}")
        return db_user

    def create_tenant_user(
        self,
        db: Session,
        username: str,
        email: str,
        hashed_password: str,
        company_id: int,
    ) -> User:
        logger.debug(f"📝 Create tenant user: {username}")
        db_user = User(
            username=username,
            email=email,
            hashed_password=hashed_password,
            is_active=True,
            role="tenant_admin",
            must_change_password=True,
            company_id=company_id,
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        logger.debug(f"✅ Tenant user persisted: {db_user.id}")
        return db_user

    def update_user(self, db: Session, user_id: int, username: Optional[str] = None, email: Optional[str] = None) -> User:
        user = self.get_user_by_id(db, user_id)
        if not user:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="User not found")
        if username and username != user.username:
            if self.get_user_by_username(db, username):
                from fastapi import HTTPException
                raise HTTPException(status_code=400, detail="Username already taken")
            user.username = username
        if email and email != user.email:
            if self.get_user_by_email(db, email):
                from fastapi import HTTPException
                raise HTTPException(status_code=400, detail="Email already in use")
            user.email = email
        db.commit()
        db.refresh(user)
        return user

    def update_password(self, db: Session, user: User, new_hashed: str) -> User:
        user.hashed_password = new_hashed
        user.must_change_password = False
        db.commit()
        db.refresh(user)
        logger.debug(f"🔑 Password updated for user: {user.id}")
        return user
