from app.utils.helpers import escape_tg_html
from app.models.user import UserNotificationResponse
from app.models.host import BaseHost
from app.models.user_template import UserTemplateResponse
from app.models.core import CoreResponse


def escape_html_user(user: UserNotificationResponse, by: str) -> tuple[str, str, str]:
    """Escapes HTML special characters in user and by strings."""
    return escape_tg_html((user.username, user.admin.username if user.admin else "None", by))


def escape_html_host(host: BaseHost, by: str) -> tuple[str, str, str, str]:
    """Escapes HTML special characters in host and by strings."""
    return escape_tg_html((host.remark, host.address, host.inbound_tag, by))


def escape_html_template(template: UserTemplateResponse, by: str) -> tuple[str, str, str, str]:
    """Escapes HTML special characters in template and by strings."""
    return escape_tg_html(
        (
            template.name,
            template.username_prefix if template.username_prefix else "",
            template.username_suffix if template.username_suffix else "",
            by,
        )
    )


def escape_html_core(core: CoreResponse, by: str) -> tuple[str, str, str, str]:
    """Escapes HTML special characters in core and by strings."""
    return escape_tg_html((core.name, core.exclude_inbound_tags, core.fallbacks_inbound_tags, by))
