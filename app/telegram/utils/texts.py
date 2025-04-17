from aiogram.utils.formatting import html_decoration as f

from app.models.user import UserResponse, UserStatus
from app.telegram.utils.shared import readable_size
from app.subscription.share import STATUS_EMOJIS

from datetime import datetime as dt
from html import escape


class Button:
    create_user = "👤 Create user"
    search = "🔎 Search"
    enable = "✅ Enable"
    disable = "❌ Disable"
    revoke_sub = "📵 Revoke Sub"
    reset_usage = "🔄 Reset Usage"
    delete = "🗑 Delete"
    activate_next_plan = "☑ Activate Next Plan"
    confirm = "✅ Confirm"
    cancel = "❌ Cancel"


class Message:
    user_not_found = "❌ User not found!"
    confirm = "⚠ Are you sure you want to proceed?"

    @staticmethod
    def status_emoji(status: UserStatus):
        return STATUS_EMOJIS[status.value]

    @staticmethod
    def user_details(user: UserResponse) -> str:
        data_limit = f.code(readable_size(user.data_limit)) if user.data_limit else "∞"
        used_traffic = f.code(readable_size(user.used_traffic))
        expire = user.expire.strftime("%Y-%m-%d %H:%M") if user.expire else "∞"
        days_left = (user.expire - dt.now()).days if user.expire else "∞"
        on_hold_timeout = user.on_hold_timeout.strftime("%Y-%m-%d %H:%M") if user.on_hold_timeout else "-"
        on_hold_expire_duration = int(user.on_hold_expire_duration / 24/60/60) if user.on_hold_expire_duration else "0"
        online_at = f.blockquote(user.online_at.strftime("%Y-%m-%d %H:%M:%S")) if user.online_at else "-"
        sub_update_at = f.code(user.sub_updated_at.strftime("%Y-%m-%d %H:%M:%S")) if user.sub_updated_at else "-"
        user_agent = f.blockquote(escape(user.sub_last_user_agent)) if user.sub_last_user_agent else "-"
        admin = f.link(user.admin.username, f"tg://user?id={user.admin.telegram_id}")
        note = f.blockquote(escape(user.note)) if user.note else "-"
        emojy_status = Message.status_emoji(user.status)

        if user.status == UserStatus.on_hold:
            expire_text = f"{f.bold('On Hold Duration: ')} {f.code(on_hold_expire_duration)} days\n"
            expire_text += f"{f.bold('On Hold Timeout:')} {f.code(on_hold_timeout)}"
        else:
            expire_text = f"{f.bold('Expire: ')} {f.code(expire)}\n"
            expire_text += f"{f.bold('Days left: ')} {f.code(days_left)}"

        return f"""\
👤 {f.bold("User Information")}

{f.bold("Status:")} {emojy_status} {user.status.value.replace("_", " ").title()}
{f.bold("Username:")} {f.code(user.username)}

{f.bold("Data Limit:")} {data_limit}
{f.bold("Used Traffic:")} {used_traffic}
{f.bold("Data Limit Strategy:")} {user.data_limit_reset_strategy.value.replace("_", " ").title()}
{expire_text}
{f.bold("Online At:")} {online_at}
{f.bold("Subscription Updated At:")} {sub_update_at}
{f.bold("Last Update User Agent:")} {user_agent}
{f.bold("Admin:")} {admin}
{f.bold("Note:")} {note}
{f.bold("Subscription URL:")}
{f.pre(user.subscription_url)}"""

    @staticmethod
    def user_short_detail(user: UserResponse) -> str:
        data_limit = readable_size(user.data_limit) if user.data_limit else "∞"
        used_traffic = readable_size(user.used_traffic)
        if user.status == UserStatus.on_hold:
            expiry = int(user.on_hold_expire_duration / 24 / 60 / 60)
        else:
            expiry = (user.expire - dt.now()).days if user.expire else "∞"
        return f"{used_traffic} / {data_limit} | {expiry} days\n{user.note or ''}"

    @staticmethod
    def confirm_disable_user(username: str) -> str:
        return f"⚠ Are you sure you want to {f.bold('Disable')} {f.code(username)}?"

    @staticmethod
    def confirm_enable_user(username: str) -> str:
        return f"⚠ Are you sure you want to {f.bold('Enable')} {f.code(username)}?"

    @staticmethod
    def confirm_delete_user(username: str) -> str:
        return f"⚠ Are you sure you want to {f.bold('Delete')} {f.code(username)}?"

    @staticmethod
    def confirm_revoke_sub(username: str) -> str:
        return f"⚠ Are you sure you want to {f.bold('Revoke Subscription')} of {f.code(username)}?"

    @staticmethod
    def confirm_reset_usage(username: str) -> str:
        return f"⚠ Are you sure you want to {f.bold('Reset Usage')} of {f.code(username)}?"

    @staticmethod
    def confirm_activate_next_plan(username: str) -> str:
        return f"⚠ Are you sure you want to {f.bold('Activate Next Plan')} for {f.code(username)}?"

