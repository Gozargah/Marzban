from datetime import datetime as dt
from datetime import timedelta as td
from typing import Any, Dict, List

from fastapi.encoders import jsonable_encoder
from requests import Session

import config
from app import app, logger, scheduler, settings
from app.db import GetDB
from app.db.models import NotificationReminder
from app.utils.notification import queue

session = Session()


def send(data: List[Dict[Any, Any]]) -> bool:
    """Send the notification to the webhook address

    Args:
        data (List[Dict[Any, Any]]): list of json encoded notifications

    Returns:
        bool: returns True if an ok response received
    """
    webhook_url = settings.get('webhook_url')
    if not webhook_url:
        return True

    try:
        logger.debug(f"Sending {len(data)} webhook updates to {webhook_url}")
        headers = {}
        if settings.get('webhook_secret'):
            headers["x-webhook-secret"] = settings['webhook_secret']
        r = session.post(webhook_url, json=data, headers=headers)
        if r.ok:
            return True
        logger.error(r)
    except Exception as err:
        logger.error(err)
    return False


def send_notifications():
    if not queue:
        return

    notifications_to_send = list()
    try:
        while (notification := queue.popleft()):
            if (notification.tries > config.NUMBER_OF_RECURRENT_NOTIFICATIONS):
                continue
            if notification.send_at > dt.utcnow().timestamp():
                queue.append(notification)  # add it to the queue again for the next check
                continue
            notifications_to_send.append(notification)
    except IndexError:  # if the queue is empty
        pass

    if not notifications_to_send:
        return
    if not send([jsonable_encoder(notif) for notif in notifications_to_send]):
        for notification in notifications_to_send:
            if (notification.tries + 1) > config.NUMBER_OF_RECURRENT_NOTIFICATIONS:
                continue
            notification.tries += 1
            notification.send_at = (  # schedule notification for n seconds later
                dt.utcnow() + td(seconds=config.RECURRENT_NOTIFICATIONS_TIMEOUT)).timestamp()
            queue.append(notification)


def delete_expired_reminders() -> None:
    with GetDB() as db:
        db.query(NotificationReminder).filter(NotificationReminder.expires_at < dt.utcnow()).delete()
        db.commit()


if settings.get('webhook_url'):
    @app.on_event("shutdown")
    def app_shutdown():
        logger.info("Sending pending notifications before shutdown...")
        send_notifications()

    logger.info("Send webhook job started")
    scheduler.add_job(send_notifications, "interval", seconds=30, replace_existing=True)
    scheduler.add_job(delete_expired_reminders, "interval", hours=2, start_date=dt.utcnow() + td(minutes=1))
