from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict, field_validator


class UserBase(BaseModel):
    username: str
    email: EmailStr


class UserCreate(UserBase):
    password: str
    company_name: str

    @field_validator("password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not any(c.isdigit() or not c.isalnum() for c in v):
            raise ValueError("Password must contain at least one number or special character.")
        return v

    @field_validator("username")
    @classmethod
    def _username_clean(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters.")
        if len(v) > 50:
            raise ValueError("Username must be at most 50 characters.")
        return v

    @field_validator("company_name")
    @classmethod
    def _company_name_clean(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("company_name is required.")
        if len(v) > 200:
            raise ValueError("company_name must be at most 200 characters.")
        return v


class UserRead(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    role: str
    model_config = ConfigDict(from_attributes=True)


class LoginInput(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
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
