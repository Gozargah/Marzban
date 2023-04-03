from typing import Union
from fastapi.templating import Jinja2Templates

from config import TEMPLATES_DIRECTORY
from .filters import CUSTOM_FILTERS


templates = Jinja2Templates(directory=TEMPLATES_DIRECTORY)
templates.env.filters.update(CUSTOM_FILTERS)


def render_to_string(template: str, context: Union[dict, None] = None) -> str:
    return templates.get_template(template).render(context or {})
