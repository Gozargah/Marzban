from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, String, DateTime, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
import logging

from app.db.models import Base

logger = logging.getLogger(__name__)


class TokenBlacklist(Base):
    __tablename__ = "token_blacklist"
    
    token_id = Column(String(255), primary_key=True, index=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    expires_at = Column(DateTime, nullable=True)


def add_token_to_blacklist(db: Session, token_id: str, expiration: Optional[datetime] = None) -> bool:
    try:
        blacklisted_token = TokenBlacklist(
            token_id=token_id,
            expires_at=expiration
        )
        db.add(blacklisted_token)
        db.commit()
        return True
    except SQLAlchemyError as e:
        logger.error(f"Error adding token to blacklist: {e}")
        db.rollback()
        return False


def is_token_in_blacklist(db: Session, token_id: str) -> bool:
    return db.query(TokenBlacklist).filter(TokenBlacklist.token_id == token_id).first() is not None


def cleanup_expired_tokens(db: Session) -> int:
    try:
        now = datetime.utcnow()
        result = db.query(TokenBlacklist).filter(
            TokenBlacklist.expires_at.isnot(None),
            TokenBlacklist.expires_at < now
        ).delete()
        db.commit()
        return result
    except SQLAlchemyError as e:
        logger.error(f"Error cleaning up expired tokens: {e}")
        db.rollback()
        return 0


def get_all_blacklisted_tokens(db: Session) -> List[TokenBlacklist]:
    return db.query(TokenBlacklist).all()
