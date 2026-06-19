from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, ConfigDict, field_validator


class TenantCreate(BaseModel):
    company_name: str
    username_or_email: str
    temp_password: str

    @field_validator("company_name")
    @classmethod
    def _company(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("company_name is required.")
        return v

    @field_validator("username_or_email")
    @classmethod
    def _identifier(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username or email must be at least 3 characters.")
        return v

    @field_validator("temp_password")
    @classmethod
    def _password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Temp password must be at least 6 characters.")
        return v


class TenantUserRead(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    must_change_password: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TenantRead(BaseModel):
    id: int
    company_name: str
    db_name: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    users: List[TenantUserRead] = []
    model_config = ConfigDict(from_attributes=True)


class AdminStats(BaseModel):
    total_tenants: int
    active_tenants: int
    suspended_tenants: int
    total_users: int
    tenants_this_month: int
    monthly_growth: List[dict]


class TenantStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def _valid_status(cls, v: str) -> str:
        if v not in ("active", "suspended"):
            raise ValueError("status must be 'active' or 'suspended'.")
        return v


class ResetPasswordResponse(BaseModel):
    user: TenantUserRead
    temp_password: str
