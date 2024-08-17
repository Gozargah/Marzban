from fastapi.responses import HTMLResponse

from app import app
from app.templates import render_template
from config import HOME_PAGE_TEMPLATE


@app.get("/", response_class=HTMLResponse)
def base():
    return render_template(HOME_PAGE_TEMPLATE)
