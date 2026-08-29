from datetime import datetime
from typing import Union

import jinja2

from config import CUSTOM_TEMPLATES_DIRECTORY

from .filters import CUSTOM_FILTERS

template_directories = ["app/templates"]
if CUSTOM_TEMPLATES_DIRECTORY:
    # User's templates have priority over default templates
    template_directories.insert(0, CUSTOM_TEMPLATES_DIRECTORY)

# HTML is escaped, the rest is not: the same environment renders the clash
# YAML and the sing-box/v2ray JSON templates, and escaping a `&` or a quote in
# those would hand the client a broken config.
env = jinja2.Environment(
    loader=jinja2.FileSystemLoader(template_directories),
    autoescape=jinja2.select_autoescape(
        enabled_extensions=("html", "htm", "xml"),
        default_for_string=False,
        default=False,
    ),
)
env.filters.update(CUSTOM_FILTERS)
env.globals['now'] = datetime.utcnow


def render_template(template: str, context: Union[dict, None] = None) -> str:
    return env.get_template(template).render(context or {})
