"""Managing the host's nginx: status, site files, uploaded pages and logs.

Sudo only, and inert until NGINX_ENABLED is set. Every response carries the
current status so the dashboard can show what `nginx -t` thinks after a change
without a second round trip — which matters here, because a saved config and a
reloaded config are not the same thing.
"""

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Path, Query, UploadFile

from app.models.admin import Admin
from app.models.nginx import (NginxAsset, NginxAssetContent, NginxAssetWrite,
                              NginxLog, NginxResult, NginxSite,
                              NginxSiteContent, NginxSiteWrite, NginxStatus,
                              NginxWebroot)
from app.utils import nginx, responses

router = APIRouter(tags=["Nginx"], prefix="/api/nginx", responses={401: responses._401})

# Site and asset names are validated in app.utils.nginx; this only keeps the
# obviously wrong shapes from reaching it through the URL.
NAME_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$"


def _when(timestamp: float) -> datetime:
    return datetime.fromtimestamp(timestamp, timezone.utc)


def _status() -> NginxStatus:
    state = nginx.status()
    return NginxStatus(
        enabled=nginx.is_enabled(),
        running=state.running,
        version=state.version,
        config_ok=state.config_ok,
        message=state.message,
        listening=state.listening,
        binary=nginx.which(),
        paths=nginx.paths(),
    )


def _guard(work):
    """Run one nginx operation, turning its failures into a 400."""
    try:
        return work()
    except nginx.NginxError as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.get("", response_model=NginxStatus, responses={403: responses._403})
def get_nginx_status(admin: Admin = Depends(Admin.check_sudo_admin)):
    """Whether nginx is running, what version, and what it thinks of its config."""
    return _status()


@router.post(
    "/test",
    response_model=NginxResult,
    responses={400: responses._400, 403: responses._403},
)
def test_nginx_config(admin: Admin = Depends(Admin.check_sudo_admin)):
    """Run `nginx -t` and report what it said, passing or not."""
    ok, message = _guard(nginx.check_config)
    return NginxResult(detail=message or ("Configuration is valid." if ok else ""), status=_status())


@router.post(
    "/reload",
    response_model=NginxResult,
    responses={400: responses._400, 403: responses._403},
)
def reload_nginx(admin: Admin = Depends(Admin.check_sudo_admin)):
    """Reload nginx, refusing while the configuration is broken."""
    message = _guard(nginx.reload)
    return NginxResult(detail=message or "Reloaded.", status=_status())


# --- sites -------------------------------------------------------------------


@router.get("/sites", response_model=List[NginxSite], responses={403: responses._403})
def get_nginx_sites(admin: Admin = Depends(Admin.check_sudo_admin)):
    """Everything in sites-available, and whether it is linked into sites-enabled."""
    sites = _guard(nginx.list_sites)
    return [
        NginxSite(
            name=site.name,
            enabled=site.enabled,
            size=site.size,
            modified_at=_when(site.modified_at),
        )
        for site in sites
    ]


@router.get(
    "/sites/{name}",
    response_model=NginxSiteContent,
    responses={400: responses._400, 403: responses._403},
)
def get_nginx_site(
    name: str = Path(pattern=NAME_PATTERN), admin: Admin = Depends(Admin.check_sudo_admin)
):
    """One site file, verbatim."""
    content = _guard(lambda: nginx.read_site(name))
    enabled = any(site.name == name and site.enabled for site in _guard(nginx.list_sites))
    return NginxSiteContent(name=name, enabled=enabled, content=content)


@router.put(
    "/sites/{name}",
    response_model=NginxResult,
    responses={400: responses._400, 403: responses._403},
)
def write_nginx_site(
    body: NginxSiteWrite,
    name: str = Path(pattern=NAME_PATTERN),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Write a site file, keeping it only if nginx accepts the result.

    A rejected config is rolled back before the response, so a bad edit never
    survives to the next reload.
    """
    message = _guard(lambda: nginx.write_site(name, body.content))
    return NginxResult(detail=message or "Saved.", status=_status())


@router.post(
    "/sites/{name}/enable",
    response_model=NginxResult,
    responses={400: responses._400, 403: responses._403},
)
def enable_nginx_site(
    name: str = Path(pattern=NAME_PATTERN), admin: Admin = Depends(Admin.check_sudo_admin)
):
    """Link a site into sites-enabled. Takes effect on the next reload."""
    _guard(lambda: nginx.enable_site(name))
    return NginxResult(detail=f"{name} enabled. Reload to apply.", status=_status())


@router.post(
    "/sites/{name}/disable",
    response_model=NginxResult,
    responses={400: responses._400, 403: responses._403},
)
def disable_nginx_site(
    name: str = Path(pattern=NAME_PATTERN), admin: Admin = Depends(Admin.check_sudo_admin)
):
    """Unlink a site from sites-enabled, keeping the file."""
    _guard(lambda: nginx.disable_site(name))
    return NginxResult(detail=f"{name} disabled. Reload to apply.", status=_status())


@router.delete(
    "/sites/{name}",
    response_model=NginxResult,
    responses={400: responses._400, 403: responses._403},
)
def remove_nginx_site(
    name: str = Path(pattern=NAME_PATTERN), admin: Admin = Depends(Admin.check_sudo_admin)
):
    """Delete a site file and its symlink."""
    _guard(lambda: nginx.remove_site(name))
    return NginxResult(detail=f"{name} deleted. Reload to apply.", status=_status())


# --- web root ----------------------------------------------------------------


@router.get("/files", response_model=NginxWebroot, responses={403: responses._403})
def get_nginx_files(admin: Admin = Depends(Admin.check_sudo_admin)):
    """Everything under the web root, which is what a placeholder site is made of."""
    assets = _guard(nginx.list_assets)
    return NginxWebroot(
        root=nginx.paths()["webroot"],
        total_bytes=sum(asset.size for asset in assets),
        assets=[
            NginxAsset(path=asset.path, size=asset.size, modified_at=_when(asset.modified_at))
            for asset in assets
        ],
    )


@router.post(
    "/files/upload",
    response_model=NginxAsset,
    responses={400: responses._400, 403: responses._403},
)
async def upload_nginx_file(
    file: UploadFile = File(...),
    path: str = Query("", description="Destination path, defaulting to the file's own name"),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Upload one file into the web root.

    The destination is validated segment by segment and then resolved against
    the web root, so nothing can be written outside it whatever the browser
    sends as a filename.
    """
    destination = path or (file.filename or "")
    content = await file.read()
    asset = _guard(lambda: nginx.write_asset(destination, content))
    return NginxAsset(path=asset.path, size=asset.size, modified_at=_when(asset.modified_at))


@router.put(
    "/files",
    response_model=NginxAsset,
    responses={400: responses._400, 403: responses._403},
)
def write_nginx_file(
    body: NginxAssetWrite, admin: Admin = Depends(Admin.check_sudo_admin)
):
    """Write a text file into the web root, for editing a page in the browser."""
    asset = _guard(lambda: nginx.write_asset(body.path, body.content.encode("utf-8")))
    return NginxAsset(path=asset.path, size=asset.size, modified_at=_when(asset.modified_at))


@router.get(
    "/files/content",
    response_model=NginxAssetContent,
    responses={400: responses._400, 403: responses._403},
)
def read_nginx_file(
    path: str = Query(..., min_length=1, max_length=256),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """One file from the web root, as text."""
    return NginxAssetContent(path=path, content=_guard(lambda: nginx.read_asset(path)))


@router.delete(
    "/files",
    responses={400: responses._400, 403: responses._403},
)
def remove_nginx_file(
    path: str = Query(..., min_length=1, max_length=256),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Delete one file from the web root."""
    _guard(lambda: nginx.remove_asset(path))
    return {"detail": f"{path} deleted"}


# --- logs --------------------------------------------------------------------


@router.get(
    "/logs/{name}",
    response_model=NginxLog,
    responses={400: responses._400, 403: responses._403},
)
def get_nginx_log(
    name: str = Path(pattern="^(access|error)$"),
    lines: int = Query(200, ge=1, le=2000),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """The tail of nginx's access or error log."""
    content = _guard(lambda: nginx.read_log(name, lines))
    return NginxLog(
        name=name,
        path=f"{nginx.paths()['log_dir']}/{nginx.LOGS[name]}",
        lines=lines,
        content=content,
    )
