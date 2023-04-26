from datetime import datetime as dt
from datetime import timedelta as td
from typing import Any

from requests import Session

import config
from app import app, logger, scheduler
from app.utils.notification import queue

session = Session()

headers = {"x-webhook-secret": config.WEBHOOK_SECRET} if config.WEBHOOK_SECRET else None


def send(data: list[dict[Any, Any]]) -> bool:
    """Send the notification to the webhook address provided by config.WEBHOOK_ADDRESS

    Args:
        data (list[dict[Any, Any]]): list of json encoded notifications

    Returns:
        bool: returns True if an ok response recieved
    """
    try:
        logger.debug(f"Sending {len(data)} webhook updates to {config.WEBHOOK_ADDRESS}")
        r = session.post(config.WEBHOOK_ADDRESS, json=data, headers=headers)
        if r.ok:
            return True
    except Exception as err:
        logger.error(err)
    return False


def send_notifications():
    if not queue:
        return

    try:
        notifications_to_send = list()
        while (notification := queue.pop()):
            if (notification.tries > config.WEBHOOK_NUMBER_OF_RECURRENT_NOTIFICATIONS):
                continue
            if dt.utcnow().timestamp() < notification.send_at:
                queue.append(notification)
                continue
            notifications_to_send.append(notification)
    except IndexError:  # if the queue is empty
        pass
    if not notifications_to_send:
        return
    if not send([notif.json() for notif in notifications_to_send]):
        for notification in notifications_to_send:
            if (notification.tries + 1) > config.WEBHOOK_NUMBER_OF_RECURRENT_NOTIFICATIONS:
                continue
            notification.tries += 1
            notification.send_at = (  # schedule notification for n seconds later
                dt.utcnow() + td(seconds=config.WEBHOOK_RECURRENT_NOTIFICATIONS_TIMEOUT)).timestamp()
            queue.append(notification)


if config.WEBHOOK_ADDRESS:
    @app.on_event("shutdown")
    def app_shutdown():
        logger.info("Sending pending notificatios before shutdown...")
        send_notifications()

    logger.info("Send webhook job started")
    scheduler.add_job(send_notifications, "interval", seconds=30)
