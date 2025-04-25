from aiogram.utils.formatting import html_decoration

from app.models.user import UserResponse, UserStatus
from app.models.system import SystemStats
from app.telegram.utils.shared import readable_size
from app.subscription.share import STATUS_EMOJIS

from datetime import datetime as dt, timedelta as td
from html import escape


B = html_decoration.bold
C = html_decoration.code
I = html_decoration.italic
U = html_decoration.underline
L = html_decoration.link
P = html_decoration.pre
PL = html_decoration.pre_language
SP = html_decoration.spoiler
ST = html_decoration.strikethrough
BL = html_decoration.blockquote
EBL = html_decoration.expandable_blockquote


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
⚙ {B("Marzban Version")}: {C(stats.version)}

📊 {B("CPU Usage")}: {C(stats.cpu_usage)} %
🎛 {B("CPU Cores")}: {C(stats.cpu_cores)}
📈 {B("Memory")}: {C(readable_size(stats.mem_used))} / {C(readable_size(stats.mem_total))} ({C(memory_percentage)} %)
🌐 {B("Total Data Usage")}: {C(readable_size(stats.outgoing_bandwidth + stats.incoming_bandwidth))}

👥 {B("Total Users")}: {C(stats.total_user)}
🟢 {B("Online Users")}: {C(stats.online_users)}
🔘 {B("Active Users")}: {C(stats.users_active)}
🔌 {B("On-Hold Users")}: {C(stats.users_on_hold)}
⌛ {B("Expired Users")}: {C(stats.users_expired)}
🪫 {B("Limited Users")}: {C(stats.users_limited)}
🔴 {B("Disabled Users")}: {C(stats.users_disabled)}
"""

    @staticmethod
    def status_emoji(status: UserStatus):
        return STATUS_EMOJIS[status.value]

    @staticmethod
    def user_details(user: UserResponse) -> str:
        data_limit = C(readable_size(user.data_limit)) if user.data_limit else "∞"
        used_traffic = C(readable_size(user.used_traffic))
        expire = user.expire.strftime("%Y-%m-%d %H:%M") if user.expire else "∞"
        days_left = (user.expire - dt.now()).days if user.expire else "∞"
        on_hold_timeout = user.on_hold_timeout.strftime("%Y-%m-%d %H:%M") if user.on_hold_timeout else "-"
        on_hold_expire_duration = td(seconds=user.on_hold_expire_duration).days if user.on_hold_expire_duration else "0"
        online_at = BL(user.online_at.strftime("%Y-%m-%d %H:%M:%S")) if user.online_at else "-"
        sub_update_at = C(user.sub_updated_at.strftime("%Y-%m-%d %H:%M:%S")) if user.sub_updated_at else "-"
        user_agent = BL(escape(user.sub_last_user_agent)) if user.sub_last_user_agent else "-"
        admin = L(user.admin.username, f"tg://user?id={user.admin.telegram_id}")
        note = BL(escape(user.note)) if user.note else "-"
        emojy_status = Message.status_emoji(user.status)

        if user.status == UserStatus.on_hold:
            expire_text = f"{B('On Hold Duration: ')} {C(on_hold_expire_duration)} days\n"
            expire_text += f"{B('On Hold Timeout:')} {C(on_hold_timeout)}"
        else:
            expire_text = f"{B('Expire: ')} {C(expire)}\n"
            expire_text += f"{B('Days left: ')} {C(days_left)}"

        return f"""\
👤 {B("User Information")}

{B("Status:")} {emojy_status} {user.status.value.replace("_", " ").title()}
{B("Username:")} {C(user.username)}

{B("Data Limit:")} {data_limit}
{B("Used Traffic:")} {used_traffic}
{B("Data Limit Strategy:")} {user.data_limit_reset_strategy.value.replace("_", " ").title()}
{expire_text}
{B("Online At:")} {online_at}
{B("Subscription Updated At:")} {sub_update_at}
{B("Last Update User Agent:")} {user_agent}
{B("Admin:")} {admin}
{B("Note:")} {note}
{B("Subscription URL:")}
{P(user.subscription_url)}"""

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
        return f"⚠ Are you sure you want to {B('Disable')} {C(username)}?"

    @staticmethod
    def confirm_enable_user(username: str) -> str:
        return f"⚠ Are you sure you want to {B('Enable')} {C(username)}?"

    @staticmethod
    def confirm_delete_user(username: str) -> str:
        return f"⚠ Are you sure you want to {B('Delete')} {C(username)}?"

    @staticmethod
    def confirm_revoke_sub(username: str) -> str:
        return f"⚠ Are you sure you want to {B('Revoke Subscription')} of {C(username)}?"

    @staticmethod
    def confirm_reset_usage(username: str) -> str:
        return f"⚠ Are you sure you want to {B('Reset Usage')} of {C(username)}?"

    @staticmethod
    def confirm_activate_next_plan(username: str) -> str:
        return f"⚠ Are you sure you want to {B('Activate Next Plan')} for {C(username)}?"
