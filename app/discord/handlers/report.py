import requests
from datetime import datetime
from app.db.models import User
from app.utils.system import readable_size
from app.models.user import UserDataLimitResetStrategy
from app.models.admin import Admin
from telebot.formatting import escape_html
from app import logger
from config import DISCORD_WEBHOOK_URL


def send_webhooks(json_data, admin_webhook:str = None):
    if DISCORD_WEBHOOK_URL:
        send_webhook(json_data=json_data, webhook=DISCORD_WEBHOOK_URL)
    if admin_webhook:
        send_webhook(json_data=json_data, webhook=admin_webhook)


def send_webhook(json_data, webhook):
    result = requests.post(webhook, json=json_data)

    try:
        result.raise_for_status()
    except requests.exceptions.HTTPError as err:
        logger.error(err)
    else:
        logger.debug("Discord payload delivered successfully, code {}.".format(result.status_code))


def report_status_change(username: str, status: str, admin: Admin = None):
    _status = {
        'active': '**:white_check_mark: Activated**',
        'disabled': '**:x: Disabled**',
        'limited': '**:low_battery: #Limited**',
        'expired': '**:clock5: #Expired**'
    }
    _status_color = {
        'active': int("9ae6b4", 16),
        'disabled': int("424b59", 16),
        'limited': int("f8a7a8", 16),
        'expired': int("fbd38d", 16)
    }
    statusChange = {
        "content": "",
        "embeds": [
            {
                "description": f"{_status[status]}\n----------------------\n**Username:** {username}",
                "color": _status_color[status],
                "footer": {
                    "text": f"Belongs To: {admin.username if admin else None}"
                },
            }
        ],
    }
    send_webhooks(
        json_data=statusChange, 
        admin_webhook=admin.discord_webhook if admin and admin.discord_webhook else None
        )

def report_new_user(username: str, by: str, expire_date: int, data_limit: int, proxies: list, has_next_plan: bool,
                    data_limit_reset_strategy:UserDataLimitResetStrategy, admin: Admin = None):

    data_limit=readable_size(data_limit) if data_limit else "Unlimited"
    expire_date=datetime.fromtimestamp(expire_date).strftime("%H:%M:%S %Y-%m-%d") if expire_date else "Never"
    proxies="" if not proxies else ", ".join([escape_html(proxy) for proxy in proxies])

    reportNewUser = {
        'content': '',
        'embeds': [
            {
                "title": ":new: Created",
                "description": f"""
                **Username:** {username}
**Traffic Limit:** {data_limit}
**Expire Date:** {expire_date}
**Proxies:** {proxies}
**Data Limit Reset Strategy:**{data_limit_reset_strategy}
**Has Next Plan:**{has_next_plan}""",

                "footer": {
                    "text": f"Belongs To: {admin.username if admin else None}\nBy: {by}"
                },
                "color": int("00ff00", 16)
            }
        ]
    }
    send_webhooks(
        json_data=reportNewUser, 
        admin_webhook=admin.discord_webhook if admin and admin.discord_webhook else None
        )

def report_user_modification(username: str, expire_date: int, data_limit: int, proxies: list, by: str, has_next_plan: bool,
                    data_limit_reset_strategy:UserDataLimitResetStrategy, admin: Admin = None):

    data_limit=readable_size(data_limit) if data_limit else "Unlimited"
    expire_date=datetime.fromtimestamp(expire_date).strftime("%H:%M:%S %Y-%m-%d") if expire_date else "Never"
    proxies="" if not proxies else ", ".join([escape_html(proxy) for proxy in proxies])
    protocols = proxies

    reportUserModification = {
        'content': '',
        'embeds':  [
            {
                'title': ':pencil2: Modified',
                'description': f"""
                **Username:** {username}
**Traffic Limit:** {data_limit}
**Expire Date:** {expire_date}
**Proxies:** {proxies}
**Data Limit Reset Strategy:**{data_limit_reset_strategy}
**Has Next Plan:**{has_next_plan}""",

                "footer": {
                    "text": f"Belongs To: {admin.username if admin else None}\nBy: {by}"
                },
                'color': int("00ffff", 16)
            }
        ]
    }
    send_webhooks(
        reportUserModification,
        admin_webhook=admin.discord_webhook if admin and admin.discord_webhook else None
        )

def report_user_deletion(username: str, by: str, admin: Admin = None):
    userDeletion = {
        'content': '',
        'embeds': [
            {
                'title': ':wastebasket: Deleted',
                'description': f'**Username: **{username}',
                "footer": {
                    "text": f"Belongs To: {admin.username if admin else None}\nBy: {by}"
                },
                'color': int("ff0000", 16)
            }
        ]
    }
    send_webhooks(
        json_data=userDeletion,
        admin_webhook=admin.discord_webhook if admin and admin.discord_webhook else None
        )

def report_user_usage_reset(username: str, by: str, admin: Admin = None):
    userUsageReset = {
        'content': '',
        'embeds': [
            {
                'title': ':repeat: Reset',
                'description': f'**Username:** {username}',
                "footer": {
                    "text": f"Belongs To: {admin.username if admin else None}\nBy: {by}"
                },
                'color': int('00ffff', 16)
            }
        ]
    }
    send_webhooks(
        json_data=userUsageReset,
        admin_webhook=admin.discord_webhook if admin and admin.discord_webhook else None
        )

def report_user_data_reset_by_next(user: User, admin: Admin = None):
    userUsageReset = {
        'content': '',
        'embeds': [
            {
                'title': ':repeat: AutoReset',
                'description': f"""
                **Username:** {user.username}
**Traffic Limit:** {user.data_limit}
**Expire Date:** {user.expire}""",

                "footer": {
                    "text": f"Belongs To: {admin.username if admin else None}"
                },
                'color': int('00ffff', 16)
            }
        ]
    }
    send_webhooks(
        json_data=userUsageReset,
        admin_webhook=admin.discord_webhook if admin and admin.discord_webhook else None
        )

def report_user_subscription_revoked(username: str, by: str, admin: Admin = None):
    subscriptionRevoked = {
        'content': '',
        'embeds': [
            {
                'title': ':repeat: Revoked',
                'description': f'**Username:** {username}',
                "footer": {
                    "text": f"Belongs To: {admin.username if admin else None} \nBy: {by}"
                },
                'color': int('ff0000', 16)
            }
        ]
    }
    send_webhooks(
        json_data=subscriptionRevoked,
        admin_webhook=admin.discord_webhook if admin and admin.discord_webhook else None
        )

def report_login(username: str, password: str, client_ip: str, status: str):
    login = {
        'content': '',
        'embeds': [
            {
                'title': ':repeat: Login',
                'description': f"""
                **Username:** {username}
**Password:** {password}
**Client ip**: {client_ip}""",
                "footer": {
                    "text": f"login status: {status}"
                },
                'color': int('ff0000', 16)
            }
        ]
    }
    send_webhooks(
        json_data=login,
        admin_webhook=None
        )
