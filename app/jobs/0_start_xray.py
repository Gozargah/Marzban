import time

import sqlalchemy
from app import app, xray
from app.db import GetDB, User, engine, get_users
from app.models.user import UserResponse, UserStatus


@xray.core.on_start
def add_users_from_db():
    if sqlalchemy.inspect(engine).has_table(User.__tablename__):
        with GetDB() as db:

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
                for proxy_type, tags in user.inbounds.items():
                    account = UserResponse.from_orm(user).get_account(proxy_type)
                    for tag in tags:
                        try:
                            xray.api.add_inbound_user(tag=tag, user=account)
                        except xray.exc.EmailExistsError:
                            pass


@app.on_event("startup")
def app_startup():
    xray.core.start()


@app.on_event("shutdown")
def app_shutdown():
    xray.core.stop()
