from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncAttrs, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, MappedAsDataclass

from config import (
    ECHO_SQL_QUERIES,
    SQLALCHEMY_DATABASE_URL,
    SQLALCHEMY_MAX_OVERFLOW,
    SQLALCHEMY_POOL_SIZE,
)

IS_SQLITE = SQLALCHEMY_DATABASE_URL.startswith("sqlite")

if IS_SQLITE:
    engine = create_async_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}, echo=ECHO_SQL_QUERIES
    )
else:
    engine = create_async_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_size=SQLALCHEMY_POOL_SIZE,
        max_overflow=SQLALCHEMY_MAX_OVERFLOW,
        pool_recycle=300,
        pool_timeout=5,
        pool_pre_ping=True,
        echo=ECHO_SQL_QUERIES,
    )

SessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Determine dialect once at startup based on connection URL
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    DATABASE_DIALECT = "sqlite"
elif SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
    DATABASE_DIALECT = "postgresql"
elif SQLALCHEMY_DATABASE_URL.startswith("mysql"):
    DATABASE_DIALECT = "mysql"
else:
    raise ValueError("Unsupported database URL")


class Base(DeclarativeBase, MappedAsDataclass, AsyncAttrs):
    pass


class GetDB:  # Context Manager
    def __init__(self):
        self.db = SessionLocal()

    async def __aenter__(self):
        return self.db

    async def __aexit__(self, exc_type, exc_value, traceback):
        if isinstance(exc_value, SQLAlchemyError):
            await self.db.rollback()  # rollback on exception

        await self.db.close()


async def get_db():  # Dependency
    async with GetDB() as db:
        yield db
