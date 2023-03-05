import time

import sqlalchemy

from app import app, xray
from app.db import GetDB, User, engine, get_users
from app.models.user import UserStatus
from app.utils.xray import xray_add_user


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
                xray_add_user(user)


@app.on_event("startup")
def app_startup():
    xray.core.start()


@app.on_event("shutdown")
def app_shutdown():
    xray.core.stop()
