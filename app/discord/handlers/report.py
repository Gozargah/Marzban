from datetime import datetime

import requests
from telebot.formatting import escape_html

from app import logger, settings
from app.utils.system import readable_size


def send_webhook(json_data):
    if settings.get('discord_webhook_url'):
        result = requests.post(settings['discord_webhook_url'], json=json_data)

        try:
            result.raise_for_status()
        except requests.exceptions.HTTPError as err:
            logger.error(err)
        else:
            logger.debug("Discord payload delivered successfully, code {}.".format(result.status_code))

def report_status_change(username: str, status: str):
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
                "color": _status_color[status]
            }
        ],
    }
    send_webhook(statusChange)

def report_new_user(user_id: int, username: str, by: str, expire_date: int, data_limit: int, proxies: list):
    
    data_limit=readable_size(data_limit) if data_limit else "Unlimited"
    expire_date=datetime.fromtimestamp(expire_date).strftime("%H:%M:%S %Y-%m-%d") if expire_date else "Never"
    proxies="" if not proxies else ", ".join([escape_html(proxy) for proxy in proxies])

    reportNewUser = {
        'content': '',
        'embeds': [
            {
                "title": ":new: Created",
                "description": f"**Username:** {username}\n**Traffic Limit:** {data_limit}\n**Expire Date:** {expire_date}\n**Proxies:** {proxies}",
                "footer": {
                    "text": f"By {by}"
                },
                "color": int("00ff00", 16)
            }
        ]
    }
    send_webhook(reportNewUser)

def report_user_modification(username: str, expire_date: int, data_limit: int, proxies: list, by: str):

    data_limit=readable_size(data_limit) if data_limit else "Unlimited"
    expire_date=datetime.fromtimestamp(expire_date).strftime("%H:%M:%S %Y-%m-%d") if expire_date else "Never"
    proxies="" if not proxies else ", ".join([escape_html(proxy) for proxy in proxies])
    protocols = proxies

    reportUserModification = {
        'content': '',
        'embeds':  [
            {
                'title': ':pencil2: Modified',
                'description': f'**Username:** {username}\n**Traffic Limit:** {data_limit}\n**Expire Date:** {expire_date}\n**Protocols:** {protocols}',
                'footer': {
                    'text':  f'By {by}'
                },
                'color': int("00ffff", 16)
            }
        ]
    }
    send_webhook(reportUserModification)

def report_user_deletion(username: str, by: str):
    userDeletion = {
        'content': '',
        'embeds': [
            {
                'title': ':wastebasket: Deleted',
                'description': f'**Username: **{username}',
                'footer': {
                    'text': f'By {by}'
                },
                'color': int("ff0000", 16)
            }
        ]
    }
    send_webhook(userDeletion)

def report_user_usage_reset(username: str, by: str):
    userUsageReset = {
        'content': '',
        'embeds': [
            {
                'title': ':repeat: Reset',
                'description': f'**Username:** {username}',
                'footer': {
                    'text': f'By {by}'
                },
                'color': int('00ffff', 16)
            }
        ]
    }
    send_webhook(userUsageReset)

def report_user_subscription_revoked(username: str, by: str):
    subscriptionRevoked = {
        'content': '',
        'embeds': [
            {
                'title': ':repeat: Revoked',
                'description': f'**Username:** {username}',
                'footer': {
                    'text': f'By {by}'
                },
                'color': int('ff0000', 16)
            }
        ]
    }
    send_webhook(subscriptionRevoked)
