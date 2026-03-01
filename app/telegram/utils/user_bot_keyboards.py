"""
Inline keyboards for the user-facing Telegram bot.
All keyboard factory methods are static and return InlineKeyboardMarkup.
"""
from telebot.types import InlineKeyboardButton, InlineKeyboardMarkup

from config import USER_BOT_STARS_1M, USER_BOT_STARS_3M, USER_BOT_STARS_6M


class UserBotKeyboard:

    @staticmethod
    def main_menu() -> InlineKeyboardMarkup:
        kb = InlineKeyboardMarkup(row_width=2)
        kb.add(
            InlineKeyboardButton("👤 Личный кабинет", callback_data="ub:cabinet"),
            InlineKeyboardButton("📱 Мой конфиг", callback_data="ub:config"),
        )
        kb.add(
            InlineKeyboardButton("💎 Продлить", callback_data="ub:buy"),
            InlineKeyboardButton("👥 Реферальная программа", callback_data="ub:referral"),
        )
        return kb

    @staticmethod
    def back_to_menu() -> InlineKeyboardMarkup:
        kb = InlineKeyboardMarkup()
        kb.add(InlineKeyboardButton("🔙 Главное меню", callback_data="ub:menu"))
        return kb

    @staticmethod
    def config_menu() -> InlineKeyboardMarkup:
        kb = InlineKeyboardMarkup(row_width=2)
        kb.add(
            InlineKeyboardButton("🔗 Ссылка подписки", callback_data="ub:sub_url"),
            InlineKeyboardButton("📷 QR-код", callback_data="ub:qr"),
        )
        kb.add(InlineKeyboardButton("🔙 Назад", callback_data="ub:menu"))
        return kb

    @staticmethod
    def buy_menu() -> InlineKeyboardMarkup:
        kb = InlineKeyboardMarkup(row_width=1)
        kb.add(
            InlineKeyboardButton(
                f"1 месяц — {USER_BOT_STARS_1M} ⭐",
                callback_data="ub:pay:30",
            ),
            InlineKeyboardButton(
                f"3 месяца — {USER_BOT_STARS_3M} ⭐  (экономия ~7%)",
                callback_data="ub:pay:90",
            ),
            InlineKeyboardButton(
                f"6 месяцев — {USER_BOT_STARS_6M} ⭐  (экономия ~13%)",
                callback_data="ub:pay:180",
            ),
        )
        kb.add(InlineKeyboardButton("🔙 Назад", callback_data="ub:menu"))
        return kb

    @staticmethod
    def pay_confirm(days: int, stars: int) -> InlineKeyboardMarkup:
        kb = InlineKeyboardMarkup(row_width=2)
        kb.add(
            InlineKeyboardButton(
                f"✅ Оплатить {stars} ⭐",
                callback_data=f"ub:pay_confirm:{days}:{stars}",
            ),
            InlineKeyboardButton("❌ Отмена", callback_data="ub:buy"),
        )
        return kb

    @staticmethod
    def referral_menu() -> InlineKeyboardMarkup:
        kb = InlineKeyboardMarkup()
        kb.add(InlineKeyboardButton("🔙 Главное меню", callback_data="ub:menu"))
        return kb
