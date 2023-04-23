from datetime import datetime as dt
from itertools import islice
from typing import Literal, Dict, List

from telebot import types  # noqa

from app import xray
from app.utils.system import readable_size


def chunk_dict(data: dict, size: int = 2):
    it = iter(data)
    for i in range(0, len(data), size):
        yield {k: data[k] for k in islice(it, size)}


class BotKeyboard:

    @staticmethod
    def main_menu():
        keyboard = types.InlineKeyboardMarkup()
        keyboard.add(
            types.InlineKeyboardButton(text='🔁 System Info', callback_data='system'),
            types.InlineKeyboardButton(text='♻️ Restart Xray', callback_data='restart'),
        )
        keyboard.add(
            types.InlineKeyboardButton(text='👥 Users', callback_data='users:1')
        )
        keyboard.add(
            types.InlineKeyboardButton(text='➕ Create User', callback_data='add_user')
        )
        keyboard.add(
            types.InlineKeyboardButton(text='➕ Create User from Template', callback_data='template_add_user')
        )
        return keyboard

    @staticmethod
    def templates_menu(templates: Dict[str, int]):
        keyboard = types.InlineKeyboardMarkup()

        for chunk in chunk_dict(templates):
            row = []
            for name, id in chunk.items():
                row.append(
                    types.InlineKeyboardButton(
                        text=name,
                        callback_data=f"template_add_user:{id}"
                    )
                )
            keyboard.add(*row)

        keyboard.add(
            types.InlineKeyboardButton(
                text='Back',
                callback_data='cancel'
            )
        )

        return keyboard

    @staticmethod
    def user_menu(user_info, with_back: bool = True, page: int = 1, view_user: bool = False):
        keyboard = types.InlineKeyboardMarkup()
        if view_user:
            keyboard.add(
                types.InlineKeyboardButton(
                    text='View User',
                    callback_data=f"user:{user_info['username']}:1"
                )
            )
        keyboard.add(
            types.InlineKeyboardButton(
                text='Suspend User' if user_info['status'] == 'active' else 'Activate User',
                callback_data=f"{'suspend' if user_info['status'] == 'active' else 'activate'}:{user_info['username']}"
            ),
            types.InlineKeyboardButton(
                text='Delete User',
                callback_data=f"delete:{user_info['username']}"
            ),
        )
        keyboard.add(
            types.InlineKeyboardButton(
                text='Show Links',
                callback_data=f"links:{user_info['username']}"
            )
        )
        keyboard.add(
            types.InlineKeyboardButton(
                text='Edit User',
                callback_data=f"edit:{user_info['username']}"
            )
        )
        if with_back:
            keyboard.add(
                types.InlineKeyboardButton(
                    text='Back',
                    callback_data=f'users:{page}'
                )
            )
        return keyboard

    @staticmethod
    def show_links(username: str):
        keyboard = types.InlineKeyboardMarkup()

        keyboard.add(
            types.InlineKeyboardButton(
                text="Generate Qr code",
                callback_data=f'genqr:{username}'
            )
        )
        keyboard.add(
            types.InlineKeyboardButton(
                text='Back',
                callback_data=f'user:{username}'
            )
        )
        return keyboard

    @staticmethod
    def confirm_action(action: str, username: str = None):
        keyboard = types.InlineKeyboardMarkup()
        keyboard.add(
            types.InlineKeyboardButton(
                text='Yes',
                callback_data=f"confirm:{action}:{username}"
            ),
            types.InlineKeyboardButton(
                text='No',
                callback_data=f"cancel"
            )
        )
        return keyboard

    @staticmethod
    def cancel_action():
        keyboard = types.ReplyKeyboardMarkup(True, False)
        keyboard.add(
            types.KeyboardButton(
                text='Cancel'
            )
        )
        return keyboard

    @staticmethod
    def inline_cancel_action(callback_data: str = "cancel"):
        keyboard = types.InlineKeyboardMarkup()
        keyboard.add(
            types.InlineKeyboardButton(
                text="Cancel",
                callback_data=callback_data
            )
        )
        return keyboard

    @staticmethod
    def user_list(users: list, page: int, total_pages: int):
        keyboard = types.InlineKeyboardMarkup()
        if len(users) >= 2:
            users = [p for p in users]
            users = [users[i:i + 2] for i in range(0, len(users), 2)]
        else:
            users = [users]
        for user in users:
            row = []
            for p in user:
                status = {
                    'active': '✅',
                    'expired': '🕰',
                    'limited': '📵',
                    'disabled': '❌'
                }
                row.append(types.InlineKeyboardButton(
                    text=f"{p.username} ({status[p.status]})",
                    callback_data=f'user:{p.username}:{page}'
                ))
            keyboard.row(*row)
        # if there is more than one page
        if total_pages > 1:
            if page > 1:
                keyboard.add(
                    types.InlineKeyboardButton(
                        text="⬅️ Previous",
                        callback_data=f'users:{page - 1}'
                    )
                )
            if page < total_pages:
                keyboard.add(
                    types.InlineKeyboardButton(
                        text="➡️ Next",
                        callback_data=f'users:{page + 1}'
                    )
                )
        keyboard.add(
            types.InlineKeyboardButton(
                text='Back',
                callback_data='cancel'
            )
        )
        return keyboard

    @staticmethod
    def select_protocols(selected_protocols: Dict[str, List[str]],
                         action: Literal["edit", "create", "create_from_template"],
                         username: str = None,
                         data_limit: int = None,
                         expire_date: dt = None):
        keyboard = types.InlineKeyboardMarkup()

        if action in ["edit", "create_from_template"]:
            keyboard.add(
                types.InlineKeyboardButton(
                    text="⚠️ Data Limit:",
                    callback_data=f"help_edit:data"
                )
            )
            keyboard.add(
                types.InlineKeyboardButton(
                    text=f"{readable_size(data_limit) if data_limit else 'Unlimited'}",
                    callback_data=f"help_edit:data"
                ),
                types.InlineKeyboardButton(
                    text="✏️Edit",
                    callback_data=f"edit_user:{username}:data"
                )
            )
            keyboard.add(
                types.InlineKeyboardButton(
                    text="📅 Expire Date:",
                    callback_data=f"help_edit:expire"
                )
            )
            keyboard.add(
                types.InlineKeyboardButton(
                    text=f"{expire_date.strftime('%Y-%m-%d') if expire_date else 'Never'}",
                    callback_data=f"help_edit:expire"
                ),
                types.InlineKeyboardButton(
                    text="✏️Edit",
                    callback_data=f"edit_user:{username}:expire"
                )
            )

        for protocol, inbounds in xray.config.inbounds_by_protocol.items():
            keyboard.add(
                types.InlineKeyboardButton(
                    text=f"🌐 {protocol.upper()} {'✅' if protocol in selected_protocols else '❌'}",
                    callback_data=f'select_protocol:{protocol}:{action}'
                )
            )
            if protocol in selected_protocols:
                for inbound in inbounds:
                    keyboard.add(
                        types.InlineKeyboardButton(
                            text=f"«{inbound['tag']}» {'✅' if inbound['tag'] in selected_protocols[protocol] else '❌'}",
                            callback_data=f'select_inbound:{inbound["tag"]}:{action}'
                        )
                    )

        keyboard.add(
            types.InlineKeyboardButton(
                text='Done',
                callback_data='confirm:edit_user' if action == "edit" else 'confirm:add_user'
            )
        )
        if action == "edit":
            keyboard.add(
                types.InlineKeyboardButton(
                    text='Cancel',
                    callback_data=f'user:{username}'
                )
            )
        else:
            keyboard.add(
                types.InlineKeyboardButton(
                    text='Cancel',
                    callback_data='cancel'
                )
            )
        return keyboard
