from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from pydantic import BaseModel, validator

from app.db import Session, crud, get_db
from app.utils.jwt import get_admin_payload
from config import SUDOERS

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/admin/token")  # Admin view url


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class Admin(BaseModel):
    username: str
    is_sudo: bool
    telegram_id: Optional[int]
    discord_webhook: Optional[str]

    class Config:
        orm_mode = True

    @classmethod
    def get_admin(cls, token: str, db: Session):
        payload = get_admin_payload(token)
        if not payload:
            return

        if payload['username'] in SUDOERS and payload['is_sudo'] is True:
            return cls(username=payload['username'], is_sudo=True)

        dbadmin = crud.get_admin(db, payload['username'])
        if not dbadmin:
            return

        if dbadmin.password_reset_at:
            if not payload.get("created_at"):
                return
            if dbadmin.password_reset_at > payload.get("created_at"):
                return

        return cls.from_orm(dbadmin)

    @classmethod
    def get_current(cls,
                    db: Session = Depends(get_db),
                    token: str = Depends(oauth2_scheme)):
        admin = cls.get_admin(token, db)
        if not admin:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return admin

    @classmethod
    def check_sudo_admin(cls,
                        db: Session = Depends(get_db),
                        token: str = Depends(oauth2_scheme)):
        admin = cls.get_admin(token, db)
        if not admin:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not admin.is_sudo:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You're not allowed"
            )
        return admin

class AdminCreate(Admin):
    password: str
    telegram_id: Optional[int]
    discord_webhook: Optional[str]

    @property
    def hashed_password(self):
        return pwd_context.hash(self.password)

    @validator("discord_webhook")
    def validate_discord_webhook(cls, value):
        if value and not value.startswith("https://discord.com"):
            raise ValueError("Discord webhook must start with 'https://discord.com'")
        return value


class AdminModify(BaseModel):
    password: Optional[str]
    is_sudo: bool
    telegram_id: Optional[int]
    discord_webhook: Optional[str]

    @property
    def hashed_password(self):
        if self.password:
            return pwd_context.hash(self.password)

    @validator("discord_webhook")
    def validate_discord_webhook(cls, value):
        if value and not value.startswith("https://discord.com"):
            raise ValueError("Discord webhook must start with 'https://discord.com'")
        return value


class AdminPartialModify(AdminModify):
    __annotations__ = {k: Optional[v] for k, v in AdminModify.__annotations__.items()}


class AdminInDB(Admin):
    username: str
    hashed_password: str

    def verify_password(self, plain_password):
        return pwd_context.verify(plain_password, self.hashed_password)

class AdminValidationResult(BaseModel):
    username: str
    is_sudo: bool