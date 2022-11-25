import sqlalchemy
from app import xray
from app.db import get_users, get_db, engine, User
from app.models.user import UserResponse, UserStatus
from app.xray import INBOUND_TAGS

if sqlalchemy.inspect(engine).has_table(User.__tablename__):
    for db in get_db():
        for user in get_users(db, status=UserStatus.active):
            account = UserResponse.from_orm(user).get_account()
            inbound = INBOUND_TAGS[user.proxy_type]
            try:
                xray.api.add_inbound_user(inbound, account)
            except xray.exc.EmailExistsError:
                pass
