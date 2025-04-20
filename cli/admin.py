import asyncio

from decouple import UndefinedValueError, config
from pydantic import ValidationError
from rich.text import Text
from sqlalchemy import func, select
from textual.app import ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.coordinate import Coordinate
from textual.widgets import Button, DataTable, Input, Static, Switch

from app.db import AsyncSession
from app.db.base import get_db
from app.db.models import Admin, User
from app.models.admin import AdminCreate, AdminDetails, AdminModify
from app.operation import OperatorType
from app.operation.admin import AdminOperation
from app.utils.helpers import readable_datetime
from app.utils.system import readable_size
from cli import BaseModal

SYSTEM_ADMIN = AdminDetails(username="cli", is_sudo=True, telegram_id=None, discord_webhook=None)


class AdminDelete(BaseModal):
    def __init__(
        self, db: AsyncSession, operation: AdminOperation, username: str, on_close: callable, *args, **kwargs
    ) -> None:
        super().__init__(*args, **kwargs)
        self.db = db
        self.operation = operation
        self.username = username
        self.on_close = on_close

    async def on_mount(self) -> None:
        """Ensure the first button is focused."""
        yes_button = self.query_one("#no")
        self.set_focus(yes_button)

    def compose(self) -> ComposeResult:
        with Container(classes="modal-box-delete"):
            yield Static("Are you sure about deleting this admin?", classes="title")
            yield Horizontal(
                Button("Yes", id="yes", variant="success"),
                Button("No", id="no", variant="error"),
                classes="button-container",
            )

    async def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "yes":
            try:
                await self.operation.remove_admin(self.db, self.username, SYSTEM_ADMIN)
                self.on_close()
            except ValueError as e:
                self.notify(str(e), severity="error", title="Error")
        await self.key_escape()


class AdminResetUsage(BaseModal):
    def __init__(
        self, db: AsyncSession, operation: AdminOperation, username: str, on_close: callable, *args, **kwargs
    ) -> None:
        super().__init__(*args, **kwargs)
        self.db = db
        self.operation = operation
        self.username = username
        self.on_close = on_close

    async def on_mount(self) -> None:
        """Ensure the first button is focused."""
        reset_button = self.query_one("#cancel")
        self.set_focus(reset_button)

    def compose(self) -> ComposeResult:
        with Container(classes="modal-box-delete"):
            yield Static("Are you sure about resetting this admin usage?", classes="title")
            yield Horizontal(
                Button("Reset", id="reset", variant="success"),
                Button("Cancel", id="cancel", variant="error"),
                classes="button-container",
            )

    async def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "reset":
            try:
                await self.operation.reset_admin_usage(self.db, self.username, SYSTEM_ADMIN)
                self.notify("Admin usage reseted successfully", severity="success", title="Success")
                self.on_close()
            except ValueError as e:
                self.notify(str(e), severity="error", title="Error")
        await self.key_escape()


class AdminCreateModale(BaseModal):
    def __init__(self, db: AsyncSession, operation: AdminOperation, on_close: callable, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.db = db
        self.operation = operation
        self.on_close = on_close

    def compose(self) -> ComposeResult:
        with Container(classes="modal-box-form"):
            yield Static("Create a new admin", classes="title")
            yield Vertical(
                Input(placeholder="Username", id="username"),
                Input(placeholder="Password", password=True, id="password"),
                Input(placeholder="Confirm Password", password=True, id="confirm_password"),
                Input(placeholder="Telegram ID", id="telegram_id", type="integer"),
                Input(placeholder="Discord Webhook", id="discord_webhook"),
                Horizontal(
                    Static("Is sudo:     ", classes="label"),
                    Switch(animate=False, id="is_sudo"),
                    classes="switch-container",
                ),
                classes="input-container",
            )
            yield Horizontal(
                Button("Create", id="create", variant="success"),
                Button("Cancel", id="cancel", variant="error"),
                classes="button-container",
            )

    async def on_mount(self) -> None:
        """Ensure the first button is focused."""
        username_input = self.query_one("#username")
        self.set_focus(username_input)

    async def key_enter(self) -> None:
        """Create admin when Enter is pressed."""
        if not self.query_one("#is_sudo").has_focus:
            await self.on_button_pressed(Button.Pressed(self.query_one("#create")))

    async def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "create":
            username = self.query_one("#username").value.strip()
            password = self.query_one("#password").value.strip()
            confirm_password = self.query_one("#confirm_password").value.strip()
            telegram_id = self.query_one("#telegram_id").value or None
            discord_webhook = self.query_one("#discord_webhook").value.strip() or None
            is_sudo = self.query_one("#is_sudo").value
            if password != confirm_password:
                self.notify("Password and confirm password do not match", severity="error", title="Error")
                return
            try:
                await self.operation.create_admin(
                    self.db,
                    AdminCreate(
                        username=username,
                        password=password,
                        telegram_id=telegram_id,
                        discord_webhook=discord_webhook,
                        is_sudo=is_sudo,
                    ),
                    SYSTEM_ADMIN,
                )
                self.notify("Admin created successfully", severity="success", title="Success")
                await self.key_escape()
                self.on_close()
            except ValidationError as e:
                for error in e.errors():
                    for err in error["msg"].split(";"):
                        self.notify(
                            err.strip(),
                            severity="error",
                            title=f"Error: {error['loc'][0].replace('_', ' ').capitalize()}",
                        )
            except ValueError as e:
                self.notify(str(e), severity="error", title="Error")
        elif event.button.id == "cancel":
            await self.key_escape()


class AdminModifyModale(BaseModal):
    def __init__(
        self, db: AsyncSession, operation: AdminOperation, admin: Admin, on_close: callable, *args, **kwargs
    ) -> None:
        super().__init__(*args, **kwargs)
        self.db = db
        self.operation = operation
        self.admin = admin
        self.on_close = on_close

    def compose(self) -> ComposeResult:
        with Container(classes="modal-box-form"):
            yield Static("Modify admin", classes="title")
            yield Vertical(
                Input(placeholder="Password", password=True, id="password"),
                Input(placeholder="Confirm Password", password=True, id="confirm_password"),
                Input(placeholder="Telegram ID", id="telegram_id", type="integer"),
                Input(placeholder="Discord Webhook", id="discord_webhook"),
                Horizontal(
                    Static("Is sudo: ", classes="label"),
                    Switch(animate=False, id="is_sudo"),
                    Static("Is disabled: ", classes="label"),
                    Switch(animate=False, id="is_disabled"),
                    classes="switch-container",
                ),
                classes="input-container",
            )
            yield Horizontal(
                Button("Save", id="save", variant="success"),
                Button("Cancel", id="cancel", variant="error"),
                classes="button-container",
            )

    async def on_mount(self) -> None:
        if self.admin.telegram_id:
            self.query_one("#telegram_id").value = str(self.admin.telegram_id)
        if self.admin.discord_webhook:
            self.query_one("#discord_webhook").value = self.admin.discord_webhook
        self.query_one("#is_sudo").value = self.admin.is_sudo
        self.query_one("#is_disabled").value = self.admin.is_disabled
        password_input = self.query_one("#password")
        self.set_focus(password_input)

    async def key_enter(self) -> None:
        """Save admin when Enter is pressed."""
        if not self.query_one("#is_disabled").has_focus and not self.query_one("#is_sudo").has_focus:
            await self.on_button_pressed(Button.Pressed(self.query_one("#save")))

    async def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "save":
            password = self.query_one("#password").value.strip() or None
            confirm_password = self.query_one("#confirm_password").value.strip() or None
            telegram_id = self.query_one("#telegram_id").value or None
            discord_webhook = self.query_one("#discord_webhook").value.strip() or None
            is_sudo = self.query_one("#is_sudo").value
            is_disabled = self.query_one("#is_disabled").value

            if password != confirm_password:
                self.notify("Password and confirm password do not match", severity="error", title="Error")
                return
            try:
                await self.operation.modify_admin(
                    self.db,
                    self.admin.username,
                    AdminModify(
                        password=password,
                        telegram_id=telegram_id,
                        discord_webhook=discord_webhook,
                        is_sudo=is_sudo,
                        is_disabled=is_disabled,
                    ),
                    SYSTEM_ADMIN,
                )
                self.notify("Admin modified successfully", severity="success", title="Success")
                await self.key_escape()
                self.on_close()
            except ValidationError as e:
                for error in e.errors():
                    for err in error["msg"].split(";"):
                        self.notify(
                            err.strip(),
                            severity="error",
                            title=f"Error: {error['loc'][0].replace('_', ' ').capitalize()}",
                        )
            except ValueError as e:
                self.notify(str(e), severity="error", title="Error")
        elif event.button.id == "cancel":
            await self.key_escape()


class AdminContent(Static):
    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.db: AsyncSession = None
        self.admin_operator = AdminOperation(OperatorType.CLI)
        self.table: DataTable = None
        self.no_admins: Static = None

    BINDINGS = [
        ("c", "create_admin", "Create admin"),
        ("m", "modify_admin", "Modify admin"),
        ("r", "reset_admin_usage", "Reset admin usage"),
        ("d", "delete_admin", "Delete admin"),
        ("i", "import_from_env", "Import from env"),
    ]

    def compose(self) -> ComposeResult:
        yield DataTable(id="admin-list")
        yield Static(
            "No admin found\n\nCreate an admin by pressing 'c'\n\nhelp by pressing '?'",
            classes="title box",
            id="no-admins",
        )

    async def on_mount(self) -> None:
        self.db = await anext(get_db())
        self.table = self.query_one("#admin-list")
        self.no_admins = self.query_one("#no-admins")
        self.no_admins.styles.display = "none"
        self.table.styles.display = "none"
        self.table.cursor_type = "row"
        self.table.styles.text_align = "center"
        await self.admins_list()

    def _center_text(self, text, width):
        padding = width - len(text)
        left_padding = padding // 2
        right_padding = padding - left_padding
        return " " * left_padding + text + " " * right_padding

    async def admins_list(self):
        self.table.clear()
        self.table.columns.clear()
        columns = (
            # "Id",
            "Username",
            "Usage",
            "Reseted usage",
            "Users Usage",
            "Is sudo",
            "Is disabled",
            "Created at",
            "Telegram ID",
            "Discord Webhook",
        )
        admins = await self.admin_operator.get_admins(self.db, offset=0, limit=10)
        if not admins:
            self.no_admins.styles.display = "block"
            return
        else:
            self.no_admins.styles.display = "none"
            self.table.styles.display = "block"
        usage_data = await asyncio.gather(
            *[self.calculate_admin_usage(admin.id) for admin in admins],
            *[self.calculate_admin_reseted_usage(admin.id) for admin in admins],
        )
        usages = usage_data[: len(admins)]
        reseted_usages = usage_data[len(admins) :]
        admins_data = [
            (
                # i + 1,
                admin.username,
                usages[i],
                reseted_usages[i],
                readable_size(admin.users_usage),
                "✔️" if admin.is_sudo else "✖️",
                "✔️" if admin.is_disabled else "✖️",
                readable_datetime(admin.created_at),
                str(admin.telegram_id or "✖️"),
                str(admin.discord_webhook or "✖️"),
            )
            for i, admin in enumerate(admins)
        ]
        column_widths = [
            max(len(str(columns[i])), max(len(str(row[i])) for row in admins_data)) for i in range(len(columns))
        ]

        centered_columns = [self._center_text(column, column_widths[i]) for i, column in enumerate(columns)]
        self.table.add_columns(*centered_columns)
        i = 1
        for row, adnin in zip(admins_data, admins):
            centered_row = [self._center_text(str(cell), column_widths[i]) for i, cell in enumerate(row)]
            label = Text(f"{i}")
            i += 1
            self.table.add_row(*centered_row, key=adnin.username, label=label)

    @property
    def selected_admin(self):
        return self.table.coordinate_to_cell_key(Coordinate(self.table.cursor_row, 0)).row_key.value

    async def action_delete_admin(self):
        if not self.table.columns:
            return
        self.app.push_screen(AdminDelete(self.db, self.admin_operator, self.selected_admin, self._refresh_table))

    def _refresh_table(self):
        self.run_worker(self.admins_list)

    async def action_create_admin(self):
        self.app.push_screen(AdminCreateModale(self.db, self.admin_operator, self._refresh_table))

    async def action_modify_admin(self):
        if not self.table.columns:
            return
        admin = await self.admin_operator.get_validated_admin(self.db, username=self.selected_admin)
        self.app.push_screen(AdminModifyModale(self.db, self.admin_operator, admin, self._refresh_table))

    async def action_import_from_env(self):
        try:
            username, password = config("SUDO_USERNAME"), config("SUDO_PASSWORD")
        except UndefinedValueError:
            self.notify(
                "Unable to get SUDO_USERNAME and/or SUDO_PASSWORD.\n"
                "Make sure you have set them in the env file or as environment variables.",
                severity="error",
                title="Error",
            )
            return
        if not (username and password):
            self.notify(
                "Unable to retrieve username and password.\nMake sure both SUDO_USERNAME and SUDO_PASSWORD are set.",
                severity="error",
                title="Error",
            )
            return
        try:
            await self.admin_operator.create_admin(
                self.db,
                AdminCreate(username=username, password=password, is_sudo=True),
                SYSTEM_ADMIN,
            )
            self.notify("Admin created successfully", severity="success", title="Success")
            self._refresh_table()
        except ValidationError as e:
            for error in e.errors():
                for err in error["msg"].split(";"):
                    self.notify(
                        err.strip(),
                        severity="error",
                        title=f"Error: {error['loc'][0].replace('_', ' ').capitalize()}",
                    )
        except ValueError as e:
            self.notify(str(e), severity="error", title="Error")

    async def action_reset_admin_usage(self):
        if not self.table.columns:
            return
        self.app.push_screen(AdminResetUsage(self.db, self.admin_operator, self.selected_admin, self._refresh_table))

    async def calculate_admin_usage(self, admin_id: int) -> str:
        usage = await self.db.execute(select(func.sum(User.used_traffic)).filter_by(admin_id=admin_id))
        return readable_size(int(usage.scalar() or 0))

    async def calculate_admin_reseted_usage(self, admin_id: int) -> str:
        usage = await self.db.execute(select(func.sum(User.reseted_usage)).filter_by(admin_id=admin_id))
        return readable_size(int(usage.scalar() or 0))

    async def key_enter(self) -> None:
        if self.table.columns:
            await self.action_modify_admin()

    async def on_prune(self, event):
        await self.db.close()
        return await super().on_prune(event)
