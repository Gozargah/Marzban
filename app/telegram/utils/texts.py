from aiogram.utils.formatting import html_decoration

from app.models.user import UserResponse, UserStatus
from app.models.system import SystemStats
from app.telegram.utils.shared import readable_size
from app.subscription.share import STATUS_EMOJIS

from datetime import datetime as dt, timedelta as td
from html import escape


b = html_decoration.bold
c = html_decoration.code
i = html_decoration.italic
u = html_decoration.underline
ln = html_decoration.link
p = html_decoration.pre
pl = html_decoration.pre_language
sp = html_decoration.spoiler
st = html_decoration.strikethrough
bl = html_decoration.blockquote
ebl = html_decoration.expandable_blockquote


class Button:
    done = "✅ Done"
    search = "🔎 Search"
    enable = "✅ Enable"
    disable = "❌ Disable"
    revoke_sub = "📵 Revoke Sub"
    reset_usage = "🔄 Reset Usage"
    delete = "🗑 Delete"
    activate_next_plan = "☑ Activate Next Plan"
    confirm = "✅ Confirm"
    cancel = "❌ Cancel"
    create_user = "👤 Create User"
    sync_users = "🔄 Sync Users"
    refresh_data = "♻ Refresh"
    users = "👥 Users"
    on_hold = "🔘 On-Hold"
    back = "🔙 Back"


class Message:
    user_not_found = "❌ User not found!"
    confirm = "⚠ Are you sure you want to proceed?"
    enter_username = "🗣 Enter new user's Username:"
    username_already_exist = "❌ Username already exists."
    enter_data_limit = "🌐 Enter Data Limit (GB):\nSend 0 for unlimited."
    data_limit_not_valid = "❌ Data limit is not valid."
    enter_duration = "📅 Enter duration: (days):\nSend 0 for unlimited."
    duration_not_valid = "❌ Duration is not valid."
    choose_status = "Do you want to enable it or keep it on-hold?"
    enter_on_hold_timeout = "🔌 Enter On-Hold timeout duration (days):\nSend 0 for Never."
    select_groups = "👥 Select Groups:"
    select_a_group = "❌ You have to select at least one group."
    canceled = "💢 Operation Canceled"
    user_created = "✅ User created successfully"
    refreshed = "♻ Refreshed successfully"
    syncing = "🔄 Syncing..."
    synced = "✅ Users successfully Synced"

    @staticmethod
    def start(stats: SystemStats):
        memory_percentage = int(stats.mem_used / stats.mem_total * 100)
        return f"""\
⚙ {b("Marzban Version")}: {c(stats.version)}

📊 {b("CPU Usage")}: {c(stats.cpu_usage)} %
🎛 {b("CPU Cores")}: {c(stats.cpu_cores)}
📈 {b("Memory")}: {c(readable_size(stats.mem_used))} / {c(readable_size(stats.mem_total))} ({c(memory_percentage)} %)
🌐 {b("Total Data Usage")}: {c(readable_size(stats.outgoing_bandwidth + stats.incoming_bandwidth))}

👥 {b("Total Users")}: {c(stats.total_user)}
🟢 {b("Online Users")}: {c(stats.online_users)}
🔘 {b("Active Users")}: {c(stats.active_users)}
🔌 {b("On-Hold Users")}: {c(stats.on_hold_users)}
⌛ {b("Expired Users")}: {c(stats.expired_users)}
🪫 {b("Limited Users")}: {c(stats.limited_users)}
🔴 {b("Disabled Users")}: {c(stats.disabled_users)}
"""

    @staticmethod
    def status_emoji(status: UserStatus):
        return STATUS_EMOJIS[status.value]

    @staticmethod
    def user_details(user: UserResponse) -> str:
        data_limit = c(readable_size(user.data_limit)) if user.data_limit else "∞"
        used_traffic = c(readable_size(user.used_traffic))
        expire = user.expire.strftime("%Y-%m-%d %H:%M") if user.expire else "∞"
        days_left = (user.expire - dt.now()).days if user.expire else "∞"
        on_hold_timeout = user.on_hold_timeout.strftime("%Y-%m-%d %H:%M") if user.on_hold_timeout else "-"
        on_hold_expire_duration = td(seconds=user.on_hold_expire_duration).days if user.on_hold_expire_duration else "0"
        online_at = bl(user.online_at.strftime("%Y-%m-%d %H:%M:%S")) if user.online_at else "-"
        sub_update_at = c(user.sub_updated_at.strftime("%Y-%m-%d %H:%M:%S")) if user.sub_updated_at else "-"
        user_agent = bl(escape(user.sub_last_user_agent)) if user.sub_last_user_agent else "-"
        admin = ln(user.admin.username, f"tg://user?id={user.admin.telegram_id}")
        note = bl(escape(user.note)) if user.note else "-"
        emojy_status = Message.status_emoji(user.status)

        if user.status == UserStatus.on_hold:
            expire_text = f"{b('On Hold Duration: ')} {c(on_hold_expire_duration)} days\n"
            expire_text += f"{b('On Hold Timeout:')} {c(on_hold_timeout)}"
        else:
            expire_text = f"{b('Expire: ')} {c(expire)}\n"
            expire_text += f"{b('Days left: ')} {c(days_left)}"

        return f"""\
👤 {b("User Information")}

{b("Status:")} {emojy_status} {user.status.value.replace("_", " ").title()}
{b("Username:")} {c(user.username)}

{b("Data Limit:")} {data_limit}
{b("Used Traffic:")} {used_traffic}
{b("Data Limit Strategy:")} {user.data_limit_reset_strategy.value.replace("_", " ").title()}
{expire_text}
{b("Online At:")} {online_at}
{b("Subscription Updated At:")} {sub_update_at}
{b("Last Update User Agent:")} {user_agent}
{b("Admin:")} {admin}
{b("Note:")} {note}
{b("Subscription URL:")}
{p(user.subscription_url)}"""

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
        return f"⚠ Are you sure you want to {b('Disable')} {c(username)}?"

    @staticmethod
    def confirm_enable_user(username: str) -> str:
        return f"⚠ Are you sure you want to {b('Enable')} {c(username)}?"

    @staticmethod
    def confirm_delete_user(username: str) -> str:
        return f"⚠ Are you sure you want to {b('Delete')} {c(username)}?"

    @staticmethod
    def confirm_revoke_sub(username: str) -> str:
        return f"⚠ Are you sure you want to {b('Revoke Subscription')} of {c(username)}?"

    @staticmethod
    def confirm_reset_usage(username: str) -> str:
        return f"⚠ Are you sure you want to {b('Reset Usage')} of {c(username)}?"

    @staticmethod
    def confirm_activate_next_plan(username: str) -> str:
        return f"⚠ Are you sure you want to {b('Activate Next Plan')} for {c(username)}?"


__all__ = ["Button", "Message"]
