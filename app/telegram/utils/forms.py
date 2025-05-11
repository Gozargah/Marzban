from aiogram.fsm.state import State, StatesGroup


class CreateUser(StatesGroup):
    username = State()
    data_limit = State()
    expire = State()
    status = State()
    on_hold_timeout = State()
    group_ids = State()
