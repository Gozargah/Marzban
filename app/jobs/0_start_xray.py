import time

import sqlalchemy
from app import xray, app
from app.db import User, engine, get_db, get_users
from app.models.user import UserResponse, UserStatus


@xray.core.on_start
def add_users_from_db():
    if sqlalchemy.inspect(engine).has_table(User.__tablename__):
        for db in get_db():

            # to prevent ConnectionError while adding users
            tries = 0
            while True:
                if tries == 5:
                    return xray.core.restart()
                try:
                    xray.api.get_sys_stats()
                    break
                except xray.exc.ConnectionError:
                    time.sleep(2)
                tries += 1

            for user in get_users(db, status=UserStatus.active):
                account = UserResponse.from_orm(user).get_account()
                inbound = xray.INBOUND_TAGS[user.proxy_type]
                try:
                    xray.api.add_inbound_user(inbound, account)
                except xray.exc.EmailExistsError:
                    pass


@app.on_event("startup")
def app_startup():
    xray.core.start()
