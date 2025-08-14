# app/schemas/auth.py
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict

# --------- User Schemas ---------
class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserRead(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    role: str
    # Pydantic v2 config
    model_config = ConfigDict(from_attributes=True)


# --------- Auth Schemas ---------
class LoginInput(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    # Expand to match our JWT claims (handy for deps and debugging)
    username: Optional[str] = None
    id: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    company_id: Optional[str] = None
    company_slug: Optional[str] = None
    db_name: Optional[str] = None
    exp: Optional[int] = None

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserRead
