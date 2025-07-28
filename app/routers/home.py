from typing import Optional

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse

from app.templates import render_template
from config import DASHBOARD_PATH, HOME_PAGE_TEMPLATE

DASHBOARD_ROUTE = DASHBOARD_PATH.rstrip("/")
router = APIRouter()


@router.get("/", response_class=HTMLResponse)
async def base():
    return render_template(HOME_PAGE_TEMPLATE)


@router.get("/manifest.json")
async def get_manifest(request: Request, start_url: Optional[str] = None):
    """
    Dynamic PWA manifest generator
    """
    # Get the base URL
    # base_url = str(request.base_url).rstrip("/")

    # Determine start URL - prioritize query param, then dashboard path, then root
    if start_url:
        # Validate that start_url is within the dashboard path for security
        if start_url.startswith(DASHBOARD_ROUTE):
            resolved_start_url = start_url
        else:
            resolved_start_url = DASHBOARD_ROUTE
    else:
        resolved_start_url = DASHBOARD_ROUTE or "/"

    manifest = {
        "name": "Marzban",
        "short_name": "Marzban",
        "description": "Marzban: Modern dashboard for managing proxies and users.",
        "theme_color": "#1b1b1d",
        "background_color": "#1b1b1d",
        "display": "standalone",
        "start_url": resolved_start_url,
        "scope": DASHBOARD_ROUTE or "/",
        "icons": [
            {"src": "/statics/favicon/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/statics/favicon/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "/statics/favicon/apple-touch-icon.png", "sizes": "180x180", "type": "image/png"},
        ],
    }

    return JSONResponse(content=manifest)
