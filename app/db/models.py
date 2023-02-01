import os
from datetime import datetime

from app.db.base import Base
from app.models.proxy import ProxyTypes
from app.models.user import UserStatus, UserDataLimitResetStrategy
from sqlalchemy import Column, Integer, BigInteger, String, Enum, JSON, DateTime, ForeignKey
from sqlalchemy.orm import relationship


class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    users = relationship("User", back_populates="admin")
    created_at = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    proxies = relationship("Proxy", back_populates="user")
    status = Column(Enum(UserStatus), default=UserStatus.active)
    used_traffic = Column(BigInteger, default=0)
    data_limit = Column(BigInteger, nullable=True)
    data_limit_reset_strategy = Column(Integer,default=UserDataLimitResetStrategy.no_reset)
    usage_logs = relationship("UserUsageResetLogs", back_populates="user")
    expire = Column(Integer, nullable=True)
    admin_id = Column(Integer, ForeignKey("admins.id"))
    admin = relationship("Admin", back_populates="users")
    created_at = Column(DateTime, default=datetime.utcnow)

class UserUsageResetLogs(Base):
    __tablename__ = "user_usage_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="usage_logs")
    used_traffic_at_reset = Column(BigInteger, nullable=False)
    reset_at = Column(DateTime, default=datetime.utcnow)

class Proxy(Base):
    __tablename__ = "proxies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="proxies")
    type = Column(Enum(ProxyTypes), nullable=False)
    settings = Column(JSON, nullable=False)


class System(Base):
    __tablename__ = "system"

    id = Column(Integer, primary_key=True, index=True)
    uplink = Column(BigInteger, default=0)
    downlink = Column(BigInteger, default=0)


class JWT(Base):
    __tablename__ = "jwt"

    id = Column(Integer, primary_key=True)
    secret_key = Column(String(64), nullable=False, default=lambda: os.urandom(32).hex())
