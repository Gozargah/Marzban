from app.models.admin import Admin


SYSTEM_ADMIN = Admin(username='system', is_sudo=True, telegram_id=None, discord_webhook=None)
