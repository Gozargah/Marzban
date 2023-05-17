from datetime import datetime
from typing import Union

import jinja2

from config import CUSTOM_TEMPLATES_DIRECTORY

from .filters import CUSTOM_FILTERS

template_directories = ["app/templates"]
if CUSTOM_TEMPLATES_DIRECTORY:
    # User's templates have priority over default templates
    template_directories.insert(0, CUSTOM_TEMPLATES_DIRECTORY)

env = jinja2.Environment(loader=jinja2.FileSystemLoader(template_directories))
env.filters.update(CUSTOM_FILTERS)
env.globals['now'] = datetime.utcnow


def render_template(template: str, context: Union[dict, None] = None) -> str:
    return env.get_template(template).render(context or {})
