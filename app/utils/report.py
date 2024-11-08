from datetime import datetime as dt
from typing import Optional

from app import telegram
from app.db import Session, create_notification_reminder, get_admin_by_id, GetDB
from app.db.models import UserStatus, User
from app.models.admin import Admin
from app.models.user import ReminderType, UserResponse
from app.utils.notification import (Notification, ReachedDaysLeft,
                                    ReachedUsagePercent, UserCreated, UserDataResetByNext,
                                    UserDataUsageReset, UserDeleted,
                                    UserDisabled, UserEnabled, UserExpired,
                                    UserLimited, UserSubscriptionRevoked,
                                    UserUpdated, notify)
from app import discord

from config import (
    NOTIFY_STATUS_CHANGE,
    NOTIFY_USER_CREATED,
    NOTIFY_USER_UPDATED,
    NOTIFY_USER_DELETED,
    NOTIFY_USER_DATA_USED_RESET,
    NOTIFY_USER_SUB_REVOKED,
    NOTIFY_IF_DATA_USAGE_PERCENT_REACHED,
    NOTIFY_IF_DAYS_LEFT_REACHED,
    NOTIFY_LOGIN
)


def status_change(
        username: str, status: UserStatus, user: UserResponse, user_admin: Admin = None, by: Admin = None) -> None:
    if NOTIFY_STATUS_CHANGE:
        try:
            telegram.report_status_change(username, status, user_admin)
        except Exception:
            pass
        if status == UserStatus.limited:
            notify(UserLimited(username=username, action=Notification.Type.user_limited, user=user))
        elif status == UserStatus.expired:
            notify(UserExpired(username=username, action=Notification.Type.user_expired, user=user))
        elif status == UserStatus.disabled:
            notify(UserDisabled(username=username, action=Notification.Type.user_disabled, user=user, by=by))
        elif status == UserStatus.active:
            notify(UserEnabled(username=username, action=Notification.Type.user_enabled, user=user, by=by))
        try:
            discord.report_status_change(username, status, user_admin)
        except Exception:
            pass


def user_created(user: UserResponse, user_id: int, by: Admin, user_admin: Admin = None) -> None:
    if NOTIFY_USER_CREATED:
        try:
            telegram.report_new_user(
                user_id=user_id,
                username=user.username,
                by=by.username,
                expire_date=user.expire,
                data_limit=user.data_limit,
                proxies=user.proxies,
                has_next_plan=user.next_plan is not None,
                data_limit_reset_strategy=user.data_limit_reset_strategy,
                admin=user_admin
            )
        except Exception:
            pass
        notify(UserCreated(username=user.username, action=Notification.Type.user_created, by=by, user=user))
        try:
            discord.report_new_user(
                username=user.username,
                by=by.username,
                expire_date=user.expire,
                data_limit=user.data_limit,
                proxies=user.proxies,
                has_next_plan=user.next_plan is not None,
                data_limit_reset_strategy=user.data_limit_reset_strategy,
                admin=user_admin
            )
        except Exception:
            pass


def user_updated(user: UserResponse, by: Admin, user_admin: Admin = None) -> None:
    if NOTIFY_USER_UPDATED:
        try:
            telegram.report_user_modification(
                username=user.username,
                expire_date=user.expire,
                data_limit=user.data_limit,
                proxies=user.proxies,
                by=by.username,
                has_next_plan=user.next_plan is not None,
                data_limit_reset_strategy=user.data_limit_reset_strategy,
                admin=user_admin
            )
        except Exception:
            pass
        notify(UserUpdated(username=user.username, action=Notification.Type.user_updated, by=by, user=user))
        try:
            discord.report_user_modification(
                username=user.username,
                expire_date=user.expire,
                data_limit=user.data_limit,
                proxies=user.proxies,
                by=by.username,
                has_next_plan=user.next_plan is not None,
                data_limit_reset_strategy=user.data_limit_reset_strategy,
                admin=user_admin
            )
        except Exception:
            pass


def user_deleted(username: str, by: Admin, user_admin: Admin = None) -> None:
    if NOTIFY_USER_DELETED:
        try:
            telegram.report_user_deletion(username=username, by=by.username, admin=user_admin)
        except Exception:
            pass
        notify(UserDeleted(username=username, action=Notification.Type.user_deleted, by=by))
        try:
            discord.report_user_deletion(username=username, by=by.username, admin=user_admin)
        except Exception:
            pass


def user_data_usage_reset(user: UserResponse, by: Admin, user_admin: Admin = None) -> None:
    if NOTIFY_USER_DATA_USED_RESET:
        try:
            telegram.report_user_usage_reset(
                username=user.username,
                by=by.username,
                admin=user_admin
            )
        except Exception:
            pass
        notify(UserDataUsageReset(username=user.username, action=Notification.Type.data_usage_reset, by=by, user=user))
        try:
            discord.report_user_usage_reset(
                username=user.username,
                by=by.username,
                admin=user_admin
            )
        except Exception:
            pass


def user_data_reset_by_next(user: UserResponse, user_admin: Admin = None) -> None:
    if NOTIFY_USER_DATA_USED_RESET:
        try:
            telegram.report_user_data_reset_by_next(
                user=user,
                admin=user_admin
            )
        except Exception:
            pass
        notify(UserDataResetByNext(username=user.username, action=Notification.Type.data_reset_by_next, user=user))
        try:
            discord.report_user_data_reset_by_next(
                user=user,
                admin=user_admin
            )
        except Exception:
            pass


def user_subscription_revoked(user: UserResponse, by: Admin, user_admin: Admin = None) -> None:
    if NOTIFY_USER_SUB_REVOKED:
        try:
            telegram.report_user_subscription_revoked(
                username=user.username,
                by=by.username,
                admin=user_admin
            )
        except Exception:
            pass
        notify(UserSubscriptionRevoked(username=user.username,
               action=Notification.Type.subscription_revoked, by=by, user=user))
        try:
            discord.report_user_subscription_revoked(
                username=user.username,
                by=by.username,
                admin=user_admin
            )
        except Exception:
            pass


def data_usage_percent_reached(
        db: Session, percent: float, user: UserResponse, user_id: int, expire: Optional[int] = None, threshold: Optional[int] = None) -> None:
    if NOTIFY_IF_DATA_USAGE_PERCENT_REACHED:
        notify(ReachedUsagePercent(username=user.username, user=user, used_percent=percent))
        create_notification_reminder(db, ReminderType.data_usage,
                                     expires_at=dt.utcfromtimestamp(expire) if expire else None, user_id=user_id, threshold=threshold)


def expire_days_reached(db: Session, days: int, user: UserResponse, user_id: int, expire: int, threshold=None) -> None:
    notify(ReachedDaysLeft(username=user.username, user=user, days_left=days))
    if NOTIFY_IF_DAYS_LEFT_REACHED:
        create_notification_reminder(
            db, ReminderType.expiration_date, expires_at=dt.utcfromtimestamp(expire),
            user_id=user_id, threshold=threshold)


def login(username: str, password: str, client_ip: str, success: bool) -> None:
    if NOTIFY_LOGIN:
        try:
            telegram.report_login(
                username=username,
                password=password,
                client_ip=client_ip,
                status="✅ Success" if success else "❌ Failed"
            )
        except Exception:
            pass
        try:
            discord.report_login(
                username=username,
                password=password,
                client_ip=client_ip,
                status="✅ Success" if success else "❌ Failed"
            )
        except Exception:
            pass
