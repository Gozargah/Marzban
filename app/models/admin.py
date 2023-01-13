from pydantic import BaseModel
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password):
    return


class Token(BaseModel):
    access_token: str
    token_type: str


class Admin(BaseModel):
    username: str

    class Config:
        orm_mode = True


class AdminCreate(Admin):
    password: str

    @property
    def hashed_password(self):
        return pwd_context.hash(self.password)


class AdminModify(BaseModel):
    password: str

    @property
    def hashed_password(self):
        return pwd_context.hash(self.password)


class AdminInDB(Admin):
    username: str
    hashed_password: str

    def verify_password(self, plain_password):
        return pwd_context.verify(plain_password, self.hashed_password)
