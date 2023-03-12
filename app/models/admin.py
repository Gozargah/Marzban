from app.db import Session, crud, get_db
from app.utils.jwt import get_admin_payload
from config import SUDOERS
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from pydantic import BaseModel

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/admin/token")  # Admin view url


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class Admin(BaseModel):
    username: str
    is_sudo: bool

    class Config:
        orm_mode = True

    @classmethod
    def get_current(cls,
                    db: Session = Depends(get_db),
                    token: str = Depends(oauth2_scheme)):
        exc = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

        payload = get_admin_payload(token)
        if not payload:
            raise exc

        if payload['username'] in SUDOERS and payload['is_sudo'] is True:
            return cls(username=payload['username'], is_sudo=True)

        dbadmin = crud.get_admin(db, payload['username'])
        if not dbadmin:
            raise exc

        return cls.from_orm(dbadmin)


class AdminCreate(Admin):
    password: str

    @property
    def hashed_password(self):
        return pwd_context.hash(self.password)


class AdminModify(BaseModel):
    password: str
    is_sudo: bool

    @property
    def hashed_password(self):
        return pwd_context.hash(self.password)


class AdminInDB(Admin):
    username: str
    hashed_password: str

    def verify_password(self, plain_password):
        return pwd_context.verify(plain_password, self.hashed_password)
