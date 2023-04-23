from app import logger, scheduler, app
from typing import Any, Dict
from app.utils.notification import queue
import config
from requests import Session
from datetime import datetime as dt


session = Session()

headers = {"x-webhook-secret": config.WEBHOOK_SECRET} if config.WEBHOOK_SECRET else None


def send(data: Dict[Any, Any]) -> bool:
    try:
        r = session.post(config.WEBHOOK_ADDRESS, json=data, headers=headers)
        if r.status_code == 200:
            return True
    except Exception as err:
        logger.error(err)
    return False


def send_notifications():
    if not queue:
        return

    try:
        while (notification := queue.pop()):
            if ((dt.utcnow().timestamp() - notification.enqueued_at) > 60 * 60 * 4) or notification.tries > 3:
                # ignore notifications after 4 hours or 3 retries
                continue
            if not send(notification.dict()):
                notification.tries += 1
                queue.append(notification)
                return  # stop sending notifications temporarily
    except IndexError:
        pass


if config.WEBHOOK_ADDRESS:
    @app.on_event("shutdown")
    def app_shutdown():
        logger.info("Sending pending notificatios before shutdown...")
        send_notifications()

    logger.info("Send webhook job started")
    scheduler.add_job(send_notifications, "interval", seconds=30)
