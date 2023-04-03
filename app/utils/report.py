from app.utils.notification import notify, Notification
from app import telegram
from app.db.models import UserStatus


def status_change(username: str, status: UserStatus) -> None:
    try:
        telegram.report_status_change(username, status)
    except Exception:
        pass
    if status == UserStatus.limited:
        notify(Notification(username=username, action="user_limited"))
    elif status == UserStatus.expired:
        notify(Notification(username=username, action="user_expired"))
    elif status == UserStatus.disabled:
        notify(Notification(username=username, action="user_disabled"))
    elif status == UserStatus.active:
        notify(Notification(username=username, action="user_enabled"))


def user_created(user_id: int, username: str, usage: int, expire_date: int, proxies: dict, by: str) -> None:
    try:
        telegram.report_new_user(
            user_id=user_id,
            username=username,
            by=by,
            expire_date=expire_date,
            usage=usage,
            proxies=proxies,
        )
    except Exception:
        pass
    notify(Notification(username=username, action="user_created"))


def user_updated(username: str, usage: int, expire_date: int, proxies: dict, by: str) -> None:
    try:
        telegram.report_user_modification(
            username=username,
            expire_date=expire_date,
            usage=usage,
            proxies=proxies,
            by=by,
        )
    except Exception:
        pass
    notify(Notification(username=username, action="user_updated"))


def user_deleted(username: str, by: str) -> None:
    try:
        telegram.report_user_deletion(username=username, by=by)
    except Exception:
        pass
    notify(Notification(username=username, action="user_deleted"))
