"""
User-facing Telegram bot handlers.

Registered on the separate `user_bot` TeleBot instance (TELEGRAM_USER_BOT_TOKEN).
Does NOT touch the admin bot (`bot`) and does NOT require is_admin=True.

Features:
  • /start [ref_CODE]   – register trial or show main menu
  • Личный кабинет      – subscription status, traffic, expiry
  • Мой конфиг          – subscription URL + QR code
  • Продлить            – pay with Telegram Stars (1 / 3 / 6 months)
  • Реферальная         – referral link and stats
"""
from __future__ import annotations

import io
import logging
import secrets
import string
from datetime import datetime, timedelta

import qrcode  # type: ignore[import-untyped]
from sqlalchemy.exc import IntegrityError

from app.db import GetDB, crud
from app.models.user import UserCreate, UserResponse
from app.telegram.user_bot_instance import user_bot
from app.telegram.utils.user_bot_keyboards import UserBotKeyboard
from app.utils.system import readable_size
from config import (
    USER_BOT_REFERRAL_BONUS_DAYS,
    USER_BOT_REFERRAL_MAX_BONUS_DAYS,
    USER_BOT_REFERRAL_REQUIRE_PAYMENT,
    USER_BOT_STARS_1M,
    USER_BOT_STARS_3M,
    USER_BOT_STARS_6M,
    USER_BOT_TRIAL_DAYS,
    USER_BOT_TRIAL_GB,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level cache for bot username (avoids get_me() on every referral press)
# ---------------------------------------------------------------------------
_bot_username: str | None = None


def _get_bot_username() -> str:
    global _bot_username
    if _bot_username is None:
        _bot_username = user_bot.get_me().username
    return _bot_username


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_REF_ALPHABET = string.ascii_letters + string.digits


def _gen_referral_code(length: int = 8) -> str:
    return "".join(secrets.choice(_REF_ALPHABET) for _ in range(length))


def _unique_referral_code(db) -> str:
    """Generate a referral code that doesn't yet exist in the DB."""
    for _ in range(20):
        code = _gen_referral_code()
        if not crud.get_user_by_referral_code(db, code):
            return code
    raise RuntimeError("Could not generate unique referral code")


def _sanitize_username(first_name: str, tg_id: int) -> str:
    """Build a valid Marzban username from Telegram first_name + id."""
    safe = "".join(c for c in first_name.lower() if c.isalnum() or c in "-_")
    safe = safe[:16] or "user"
    return f"{safe}_{tg_id}"[-32:]


def _build_proxies_and_inbounds() -> tuple[dict, dict]:
    """Return (proxies_dict, inbounds_dict) with all currently active inbounds."""
    from app import xray
    from app.models.proxy import ProxyTypes
    from config import TELEGRAM_DEFAULT_VLESS_FLOW

    inbounds: dict[str, list[str]] = {}
    proxies: dict = {}

    for protocol, ibs in xray.config.inbounds_by_protocol.items():
        tags = [ib["tag"] for ib in ibs]
        if not tags:
            continue
        inbounds[protocol] = tags
        extra = {}
        if protocol == ProxyTypes.VLESS and TELEGRAM_DEFAULT_VLESS_FLOW:
            extra["flow"] = TELEGRAM_DEFAULT_VLESS_FLOW
        proxies[protocol] = extra

    return proxies, inbounds


def _grant_referral_bonus(db, referrer) -> bool:
    """
    Award USER_BOT_REFERRAL_BONUS_DAYS to *referrer* if they haven't hit the cap.
    Used in REQUIRE_PAYMENT mode. Returns True if days were actually added.
    """
    already = crud.count_user_referrals(db, referrer)
    if USER_BOT_REFERRAL_MAX_BONUS_DAYS > 0:
        if already * USER_BOT_REFERRAL_BONUS_DAYS >= USER_BOT_REFERRAL_MAX_BONUS_DAYS:
            return False

    now_ts = int(datetime.utcnow().timestamp())
    current_expire = referrer.expire or now_ts
    referrer.expire = max(current_expire, now_ts) + USER_BOT_REFERRAL_BONUS_DAYS * 24 * 3600
    db.commit()
    return True


def _get_or_create_user(db, tg_user, referral_code: str | None = None):
    """
    Return the existing Marzban user linked to *tg_user.id*, or create a
    brand-new trial account.

    Returns (db_user, is_new: bool).
    Raises nothing – all errors are caught and logged.
    """
    existing = crud.get_user_by_telegram_id(db, tg_user.id)
    if existing:
        return existing, False

    # ── Create trial account ────────────────────────────────────────────────
    from app import xray

    proxies, inbounds = _build_proxies_and_inbounds()
    if not proxies:
        logger.warning("user_bot: no inbounds in xray config, creating user without proxies")

    username = _sanitize_username(tg_user.first_name or "user", tg_user.id)
    base = username
    suffix = 0
    while crud.get_user(db, username):
        suffix += 1
        username = f"{base[:28]}_{suffix}"

    # Expire at midnight UTC + TRIAL_DAYS
    expire_ts = int(
        (datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
         + timedelta(days=USER_BOT_TRIAL_DAYS)).timestamp()
    )
    data_limit_bytes = USER_BOT_TRIAL_GB * 1024 ** 3

    new_user_schema = UserCreate(
        username=username,
        status="active",
        expire=expire_ts,
        data_limit=data_limit_bytes,
        proxies=proxies,
        inbounds=inbounds,
    )

    sudo_admin = None
    for adm in crud.get_admins(db):
        if adm.is_sudo:
            sudo_admin = adm
            break

    # FIX #2: handle IntegrityError (race condition – two /start at same time)
    try:
        db_user = crud.create_user(db, new_user_schema, admin=sudo_admin)
    except IntegrityError:
        db.rollback()
        # Another request won the race; return what's already in DB
        existing = crud.get_user_by_telegram_id(db, tg_user.id)
        if existing:
            return existing, False
        raise  # unexpected – re-raise for logging

    crud.link_user_telegram_id(db, db_user, tg_user.id)
    crud.set_user_referral_code(db, db_user, _unique_referral_code(db))

    # Handle referral reward
    if referral_code:
        referrer = crud.get_user_by_referral_code(db, referral_code)
        if referrer and referrer.id != db_user.id:
            bonus_granted = crud.record_referral(db, db_user, referrer)
            _notify_referrer(referrer, bonus_granted)

    # Add to Xray core
    try:
        xray.operations.add_user(db_user)
    except Exception as exc:
        logger.error("user_bot: xray.operations.add_user failed: %s", exc)

    return db_user, True


def _notify_referrer(referrer, bonus_granted: bool) -> None:
    """Send a Telegram notification to referrer. Silently skips if no telegram_id."""
    if not referrer.telegram_id:
        return
    try:
        if bonus_granted:
            user_bot.send_message(
                referrer.telegram_id,
                f"🎉 По вашей реферальной ссылке зарегистрировался новый пользователь!\n"
                f"Ваша подписка продлена на <b>{USER_BOT_REFERRAL_BONUS_DAYS} дней</b>.",
                parse_mode="HTML",
            )
        elif USER_BOT_REFERRAL_REQUIRE_PAYMENT:
            user_bot.send_message(
                referrer.telegram_id,
                f"👥 По вашей ссылке зарегистрировался новый пользователь.\n"
                f"<b>+{USER_BOT_REFERRAL_BONUS_DAYS} дней</b> будут начислены "
                f"после его первой оплаты.",
                parse_mode="HTML",
            )
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------

_STATUS_EMOJI = {
    "active":   "✅",
    "expired":  "🕰",
    "limited":  "📵",
    "disabled": "❌",
    "on_hold":  "⏸",
}


def _account_text(db_user) -> str:
    """
    Build an HTML status string from a DB user object.
    Must be called while the SQLAlchemy session is still open (db_user attached).
    """
    user = UserResponse.model_validate(db_user)

    status_icon = _STATUS_EMOJI.get(user.status, "❓")
    data_limit  = readable_size(user.data_limit) if user.data_limit else "Безлимит"
    used        = readable_size(user.used_traffic) if user.used_traffic else "0 B"

    if user.data_limit:
        remaining = max(0, user.data_limit - user.used_traffic)
        data_line = (
            f"📊 Трафик: <code>{used}</code> / <code>{data_limit}</code>"
            f"  (осталось <code>{readable_size(remaining)}</code>)"
        )
    else:
        data_line = f"📊 Трафик: <code>{used}</code> / <code>{data_limit}</code>"

    if user.expire:
        exp_dt    = datetime.fromtimestamp(user.expire)
        days_left = max(0, (exp_dt - datetime.now()).days)
        exp_line  = f"📅 Истекает: <code>{exp_dt.date()}</code>  (осталось дней: <code>{days_left}</code>)"
    else:
        exp_line = "📅 Истекает: <code>никогда</code>"

    return (
        f"{status_icon} <b>Статус:</b> <code>{user.status}</code>\n\n"
        f"👤 <b>Аккаунт:</b> <code>{user.username}</code>\n"
        f"{data_line}\n"
        f"{exp_line}"
    )


# ---------------------------------------------------------------------------
# /start
# ---------------------------------------------------------------------------

@user_bot.message_handler(commands=["start"])
def cmd_start(message):
    args = message.text.split(maxsplit=1)
    ref_code: str | None = None
    if len(args) > 1 and args[1].startswith("ref_"):
        ref_code = args[1][4:]

    tg_user = message.from_user

    # FIX #1: build reply text INSIDE the session so db_user is still attached
    with GetDB() as db:
        try:
            db_user, is_new = _get_or_create_user(db, tg_user, ref_code)
        except Exception as exc:
            logger.exception("user_bot: failed to get/create user for %s: %s", tg_user.id, exc)
            user_bot.reply_to(message, "⚠️ Произошла ошибка. Попробуйте позже.")
            return

        if is_new:
            text = (
                f"👋 Привет, <b>{tg_user.first_name}</b>!\n\n"
                f"Для вас создан пробный аккаунт:\n"
                f"  • <b>{USER_BOT_TRIAL_DAYS} дней</b>\n"
                f"  • <b>{USER_BOT_TRIAL_GB} ГБ</b> трафика\n\n"
                f"Нажмите <b>«Мой конфиг»</b>, чтобы получить настройки подключения."
            )
        else:
            text = f"👋 С возвращением, <b>{tg_user.first_name}</b>!\n\n" + _account_text(db_user)

    user_bot.send_message(
        message.chat.id,
        text,
        parse_mode="HTML",
        reply_markup=UserBotKeyboard.main_menu(),
    )


# ---------------------------------------------------------------------------
# Callback query router
# ---------------------------------------------------------------------------

@user_bot.callback_query_handler(func=lambda c: c.data.startswith("ub:"))
def cb_router(call):
    tg_id  = call.from_user.id
    parts  = call.data.split(":")
    action = parts[1] if len(parts) > 1 else ""

    # FIX #4: single DB session for the whole handler; build text inside it
    with GetDB() as db:
        db_user = crud.get_user_by_telegram_id(db, tg_id)

        if db_user is None:
            user_bot.answer_callback_query(
                call.id, "❌ Аккаунт не найден. Напишите /start", show_alert=True
            )
            return

        # ── Main menu ────────────────────────────────────────────────────────
        if action == "menu":
            user_bot.answer_callback_query(call.id)
            user_bot.edit_message_text(
                f"👤 <b>Главное меню</b>\n\n{_account_text(db_user)}",
                call.message.chat.id,
                call.message.message_id,
                parse_mode="HTML",
                reply_markup=UserBotKeyboard.main_menu(),
            )

        # ── Personal cabinet ─────────────────────────────────────────────────
        elif action == "cabinet":
            user_bot.answer_callback_query(call.id)
            user_bot.edit_message_text(
                f"👤 <b>Личный кабинет</b>\n\n{_account_text(db_user)}",
                call.message.chat.id,
                call.message.message_id,
                parse_mode="HTML",
                reply_markup=UserBotKeyboard.back_to_menu(),
            )

        # ── Config menu ──────────────────────────────────────────────────────
        elif action == "config":
            user_bot.answer_callback_query(call.id)
            user_bot.edit_message_text(
                "📱 <b>Мой конфиг</b>\n\nВыберите формат:",
                call.message.chat.id,
                call.message.message_id,
                parse_mode="HTML",
                reply_markup=UserBotKeyboard.config_menu(),
            )

        # ── Subscription URL ─────────────────────────────────────────────────
        elif action == "sub_url":
            user_bot.answer_callback_query(call.id)
            user = UserResponse.model_validate(db_user)
            user_bot.edit_message_text(
                f"🔗 <b>Ссылка подписки</b>\n\n"
                f"<code>{user.subscription_url}</code>\n\n"
                f"Скопируйте ссылку и добавьте её в ваш клиент (Happ, v2rayNG, Nekoray и т.д.).",
                call.message.chat.id,
                call.message.message_id,
                parse_mode="HTML",
                reply_markup=UserBotKeyboard.back_to_menu(),
            )

        # ── QR code ──────────────────────────────────────────────────────────
        elif action == "qr":
            user_bot.answer_callback_query(call.id, "Генерирую QR-код…")
            user = UserResponse.model_validate(db_user)
            with io.BytesIO() as buf:
                qr = qrcode.QRCode(border=6)
                qr.add_data(user.subscription_url)
                qr.make_image().save(buf)
                buf.seek(0)
                user_bot.send_photo(
                    call.message.chat.id,
                    photo=buf,
                    caption=(
                        f"📷 <b>QR-код подписки</b>\n\n"
                        f"<code>{user.subscription_url}</code>"
                    ),
                    parse_mode="HTML",
                    reply_markup=UserBotKeyboard.back_to_menu(),
                )

        # ── Buy / extend ─────────────────────────────────────────────────────
        elif action == "buy":
            user_bot.answer_callback_query(call.id)
            user_bot.edit_message_text(
                "💎 <b>Продление подписки</b>\n\n"
                "Оплата производится через <b>Telegram Stars</b> ⭐.\n"
                "Выберите срок:",
                call.message.chat.id,
                call.message.message_id,
                parse_mode="HTML",
                reply_markup=UserBotKeyboard.buy_menu(),
            )

        elif action == "pay":
            _stars_map  = {30: USER_BOT_STARS_1M, 90: USER_BOT_STARS_3M, 180: USER_BOT_STARS_6M}
            _months_map = {30: "1 месяц", 90: "3 месяца", 180: "6 месяцев"}
            try:
                days = int(parts[2])
            except (IndexError, ValueError):
                user_bot.answer_callback_query(call.id, "Неверный параметр")
                return
            stars  = _stars_map.get(days, USER_BOT_STARS_1M)
            months = _months_map.get(days, f"{days} дней")
            user_bot.answer_callback_query(call.id)
            user_bot.edit_message_text(
                f"💎 <b>Подтверждение оплаты</b>\n\n"
                f"Срок: <b>{months}</b>\n"
                f"Стоимость: <b>{stars} ⭐</b>\n\n"
                f"Нажмите кнопку ниже, чтобы оплатить:",
                call.message.chat.id,
                call.message.message_id,
                parse_mode="HTML",
                reply_markup=UserBotKeyboard.pay_confirm(days, stars),
            )

        elif action == "pay_confirm":
            try:
                days  = int(parts[2])
                stars = int(parts[3])
            except (IndexError, ValueError):
                user_bot.answer_callback_query(call.id, "Неверный параметр")
                return
            user_bot.answer_callback_query(call.id)
            user_bot.send_invoice(
                chat_id=call.message.chat.id,
                title=f"VPN подписка на {days} дней",
                description=f"Продление VPN-подписки на {days} календарных дней",
                invoice_payload=f"extend:{days}:{tg_id}",
                provider_token="",   # empty string = Telegram Stars
                currency="XTR",
                prices=[{"label": f"{days} дней", "amount": stars}],
            )

        # ── Referral ─────────────────────────────────────────────────────────
        elif action == "referral":
            user_bot.answer_callback_query(call.id)
            ref_count  = crud.count_user_referrals(db, db_user)
            ref_code   = db_user.referral_code or "—"
            # FIX #5: cached, no network call per click
            ref_link   = f"https://t.me/{_get_bot_username()}?start=ref_{ref_code}"

            earned_days = ref_count * USER_BOT_REFERRAL_BONUS_DAYS
            if USER_BOT_REFERRAL_MAX_BONUS_DAYS > 0:
                remaining_cap = max(0, USER_BOT_REFERRAL_MAX_BONUS_DAYS - earned_days)
                cap_line = (
                    f"📈 Заработано бонусов: <b>{earned_days} дн.</b> "
                    f"из <b>{USER_BOT_REFERRAL_MAX_BONUS_DAYS} дн.</b> максимум\n"
                    f"💡 Ещё доступно: <b>{remaining_cap} дн.</b>"
                )
            else:
                cap_line = f"📈 Заработано бонусов: <b>{earned_days} дн.</b>"

            payment_note = (
                "\n\n⚠️ Бонус начисляется после первой оплаты приглашённого."
                if USER_BOT_REFERRAL_REQUIRE_PAYMENT else ""
            )

            user_bot.edit_message_text(
                f"👥 <b>Реферальная программа</b>\n\n"
                f"За каждого приглашённого друга вы получаете "
                f"<b>+{USER_BOT_REFERRAL_BONUS_DAYS} дней</b> к подписке."
                f"{payment_note}\n\n"
                f"🔗 Ваша реферальная ссылка:\n<code>{ref_link}</code>\n\n"
                f"👤 Приглашено пользователей: <b>{ref_count}</b>\n"
                f"{cap_line}",
                call.message.chat.id,
                call.message.message_id,
                parse_mode="HTML",
                reply_markup=UserBotKeyboard.referral_menu(),
            )

        else:
            user_bot.answer_callback_query(call.id, "Неизвестная команда")


# ---------------------------------------------------------------------------
# Pre-checkout (must answer within 10 s)
# ---------------------------------------------------------------------------

@user_bot.pre_checkout_query_handler(func=lambda q: True)
def pre_checkout(query):
    user_bot.answer_pre_checkout_query(query.id, ok=True)


# ---------------------------------------------------------------------------
# Successful payment
# ---------------------------------------------------------------------------

@user_bot.message_handler(content_types=["successful_payment"])
def successful_payment(message):
    payload = message.successful_payment.invoice_payload  # "extend:<days>:<tg_id>"
    try:
        _, days_str, tg_id_str = payload.split(":")
        days   = int(days_str)
        tg_id  = int(tg_id_str)
    except Exception:
        logger.error("user_bot: bad invoice payload: %s", payload)
        return

    # FIX #1: build reply text INSIDE the session
    with GetDB() as db:
        db_user = crud.get_user_by_telegram_id(db, tg_id)
        if not db_user:
            logger.error("user_bot: payment for unknown tg_id %s", tg_id)
            return

        crud.extend_user_expire(db, db_user, days)
        # Reload after update so _account_text sees fresh data
        db_user = crud.get_user_by_telegram_id(db, tg_id)

        # Deferred referral bonus (REQUIRE_PAYMENT mode)
        if USER_BOT_REFERRAL_REQUIRE_PAYMENT and db_user.referred_by_id:
            referrer = crud.get_user_by_id(db, db_user.referred_by_id)
            if referrer:
                sentinel = f"[ref_paid:{referrer.id}]"
                note = db_user.note or ""
                if sentinel not in note:
                    db_user.note = (note + sentinel)[-500:]
                    db.commit()
                    bonus_granted = _grant_referral_bonus(db, referrer)
                    if bonus_granted and referrer.telegram_id:
                        try:
                            user_bot.send_message(
                                referrer.telegram_id,
                                f"💰 Ваш приглашённый совершил первую оплату!\n"
                                f"Ваша подписка продлена на "
                                f"<b>{USER_BOT_REFERRAL_BONUS_DAYS} дней</b>.",
                                parse_mode="HTML",
                            )
                        except Exception:
                            pass

        # Re-sync Xray
        try:
            from app import xray
            xray.operations.update_user(db_user)
        except Exception as exc:
            logger.error("user_bot: xray.operations.update_user failed: %s", exc)

        months  = {30: "1 месяц", 90: "3 месяца", 180: "6 месяцев"}.get(days, f"{days} дней")
        reply   = (
            f"✅ Оплата прошла успешно!\n\n"
            f"Подписка продлена на <b>{months}</b>.\n\n"
            + _account_text(db_user)
        )

    user_bot.send_message(
        message.chat.id,
        reply,
        parse_mode="HTML",
        reply_markup=UserBotKeyboard.main_menu(),
    )
