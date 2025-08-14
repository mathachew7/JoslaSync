from sqlalchemy.orm import Session
from app.db.models.user import User
from app.schemas.auth import UserCreate
from app.core.logger import logger
from app.core.config import settings
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, user: UserCreate):
    hashed_pw = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_pw
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    logger.info(f"User registered: {db_user.username}")
    return db_user

def is_master_user(username: str, password: str) -> bool:
    return (
        username == settings.MASTER_USERNAME
        and password == settings.MASTER_PASSWORD
    )

def is_master_username(username: str) -> bool:
    return username == settings.MASTER_USERNAME
