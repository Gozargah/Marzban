import os
from datetime import datetime

from app.db.base import Base
from app.models.proxy import ProxyTypes
from app.models.user import UserStatus
from sqlalchemy import Column, Integer, BigInteger, String, Enum, JSON, DateTime


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    proxy_type = Column(Enum(ProxyTypes), nullable=False)
    settings = Column(JSON, nullable=False)
    status = Column(Enum(UserStatus), default=UserStatus.active)
    used_traffic = Column(BigInteger, default=0)
    data_limit = Column(BigInteger, nullable=True)
    expire = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class System(Base):
    __tablename__ = "system"

    id = Column(Integer, primary_key=True, index=True)
    uplink = Column(BigInteger, default=0)
    downlink = Column(BigInteger, default=0)


class JWT(Base):
    __tablename__ = "jwt"

    id = Column(Integer, primary_key=True)
    secret_key = Column(String(64), nullable=False, default=lambda: os.urandom(32).hex())
