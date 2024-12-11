from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import (
    SQLALCHEMY_DATABASE_URL,
    SQLALCHEMY_POOL_SIZE,
    SQLIALCHEMY_MAX_OVERFLOW,
)

IS_SQLITE = SQLALCHEMY_DATABASE_URL.startswith('sqlite')

if IS_SQLITE:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_size=SQLALCHEMY_POOL_SIZE,
        max_overflow=SQLIALCHEMY_MAX_OVERFLOW,
        pool_recycle=3600,
        pool_timeout=10
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass
