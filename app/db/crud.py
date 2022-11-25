import json

from sqlalchemy.orm import Session

from app.db.models import JWT, User, System
from app.models.user import UserCreate, UserModify, UserStatus


def get_user(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()


def get_user_by_id(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()


def get_users(db: Session, offset: int = None, limit: int = None, status: UserStatus = None):
    query = db.query(User)
    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)
    if status:
        query = query.filter(User.status == status)
    return query.all()


def get_users_count(db: Session, status: UserStatus = None):
    query = db.query(User.id)
    if status:
        query = query.filter(User.status == status)
    return query.count()


def create_user(db: Session, user: UserCreate):
    dbuser = User(
        username=user.username,
        proxy_type=user.proxy_type,
        settings=json.loads(user.settings.json()),
        data_limit=(user.data_limit or None),
        expire=(user.expire or None)
    )
    db.add(dbuser)
    db.commit()
    db.refresh(dbuser)
    return dbuser


def remove_user(db: Session, dbuser: User):
    db.delete(dbuser)
    db.commit()
    return dbuser


def update_user(db: Session, dbuser: User, modify: UserModify):
    if modify.settings is not None:
        dbuser.settings = json.loads(modify.settings.json())

    if modify.data_limit is not None:
        dbuser.data_limit = (modify.data_limit or None)

    if modify.expire is not None:
        dbuser.expire = (modify.expire or None)

    db.commit()
    db.refresh(dbuser)
    return dbuser


def update_user_status(db: Session, dbuser: User, status: UserStatus):
    dbuser.status = status
    db.commit()
    db.refresh(dbuser)
    return dbuser


def get_system_usage(db: Session):
    return db.query(System).first()


def get_jwt_secret_key(db: Session):
    return db.query(JWT).first().secret_key
