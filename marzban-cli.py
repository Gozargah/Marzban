#! /usr/bin/env python3
from textual.app import App, ComposeResult
from textual.widgets import Footer, Header

from cli.help import HelpModal


class MarzbanCLI(App):
    """A Textual app to manage marzban"""

    CSS_PATH = "cli/style.tcss"

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.theme = "textual-dark"

    BINDINGS = [
        ("ctrl+c", "quit", "Quit"),
        ("q", "quit", "Quit"),
        ("?", "help", "Help"),
    ]

    def compose(self) -> ComposeResult:
        """Create child widgets for the app."""
        from cli.admin import AdminContent

        yield Header()
        yield AdminContent(id="admin-content")
        yield Footer()

    def on_mount(self) -> None:
        """Called when the app is mounted."""
        self.action_show_admins()

    def action_show_admins(self) -> None:
        """Show the admins section."""
        self.query_one("#admin-content")

    async def action_quit(self) -> None:
        """An action to quit the app."""
        self.exit()

    def action_help(self) -> None:
        """Show help information in a modal."""
        admin_content = self.query_one("#admin-content")
        self.push_screen(HelpModal(self.BINDINGS, admin_content.BINDINGS))


if __name__ == "__main__":
    app = MarzbanCLI()
    app.run()
