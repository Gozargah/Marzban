from enum import StrEnum
from aiogram.utils.keyboard import InlineKeyboardBuilder
from app.models.group import GroupsResponse
from aiogram.filters.callback_data import CallbackData


class DoneAction(StrEnum):
    done = "done"
    cancel = "cancel"


class GroupsSelector(InlineKeyboardBuilder):
    def __init__(self, groups: GroupsResponse, selected_groups: list[int] | None = None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for group in groups.groups:
            self.button(
                text=f"✅ {group.name}" if selected_groups and group.id in selected_groups else f"❌ {group.name}",
                callback_data=self.SelectorCallback(group_id=group.id, group_name=group.name),
            )
        self.button(text="Done", callback_data=self.DoneCallback(action=DoneAction.done))
        self.button(text="Cancel", callback_data=self.DoneCallback(action=DoneAction.cancel))
        self.adjust(1, 1)

    class SelectorCallback(CallbackData, prefix="group-select"):
        group_id: int
        group_name: str

    class DoneCallback(CallbackData, prefix="group-select-done"):
        action: DoneAction
