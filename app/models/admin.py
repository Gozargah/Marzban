from passlib.context import CryptContext
from pydantic import BaseModel, ConfigDict, field_validator

from .validators import DiscordValidator, NumericValidatorMixin, PasswordValidator

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminBase(BaseModel):
    """Minimal admin model containing only the username."""

    username: str

    model_config = ConfigDict(from_attributes=True)


class AdminContactInfo(AdminBase):
    """Base model containing the core admin identification fields."""

    username: str
    telegram_id: int | None = None
    discord_webhook: str | None = None
    sub_domain: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminDetails(AdminContactInfo):
    """Complete admin model with all fields for database representation and API responses."""

    id: int | None = None
    is_sudo: bool
    total_users: int = 0
    used_traffic: int = 0
    is_disabled: bool = False
    discord_id: int | None = None
    sub_template: str | None = None
    profile_title: str | None = None
    support_url: str | None = None
    lifetime_used_traffic: int | None = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("used_traffic", mode="before")
    def cast_to_int(cls, v):
        return NumericValidatorMixin.cast_to_int(v)


class AdminModify(BaseModel):
    password: str | None = None
    is_sudo: bool
    telegram_id: int | None = None
    discord_webhook: str | None = None
    discord_id: int | None = None
    is_disabled: bool | None = None
    sub_template: str | None = None
    sub_domain: str | None = None
    profile_title: str | None = None
    support_url: str | None = None

    @property
    def hashed_password(self):
        if self.password:
            return pwd_context.hash(self.password)

    @field_validator("discord_webhook")
    @classmethod
    def validate_discord_webhook(cls, value):
        return DiscordValidator.validate_webhook(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str | None):
        return PasswordValidator.validate_password(value)


class AdminCreate(AdminModify):
    """Model for creating new admin accounts requiring username and password."""

    username: str
    password: str


class AdminInDB(AdminDetails):
    hashed_password: str

    def verify_password(self, plain_password):
        return pwd_context.verify(plain_password, self.hashed_password)


class AdminValidationResult(BaseModel):
    username: str
    is_sudo: bool
    is_disabled: bool
