from telebot import types  # noqa


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
        return keyboard

    @staticmethod
    def user_menu(user_info, with_back: bool = True, page: int = 1):
        keyboard = types.InlineKeyboardMarkup()
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
        if with_back:
            keyboard.add(
                types.InlineKeyboardButton(
                    text='Back',
                    callback_data=f'users:{page}'
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
    def select_protocols(selected: list):
        keyboard = types.InlineKeyboardMarkup()
        protocols = ['vmess', 'vless', 'trojan', 'shadowsocks']
        protocols = [protocols[i:i + 2] for i in range(0, len(protocols), 2)]
        for protocol in protocols:
            row = []
            for p in protocol:
                row.append(types.InlineKeyboardButton(
                    text=f"{p.upper()} {'✅' if p in selected else '❌'}",
                    callback_data=f'select:{p}'
                ))
            keyboard.row(*row)
        keyboard.add(
            types.InlineKeyboardButton(
                text='Done',
                callback_data='confirm:add_user'
            )
        )
        keyboard.add(
            types.InlineKeyboardButton(
                text='Cancel',
                callback_data='cancel'
            )
        )
        return keyboard
