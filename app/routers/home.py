from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from config import HOME_PAGE_TEMPLATE
from app.templates import render_template

router = APIRouter()


@router.get("/", response_class=HTMLResponse)
def base():
    return render_template(HOME_PAGE_TEMPLATE)