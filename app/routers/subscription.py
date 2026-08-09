import re
import base64
from distutils.version import LooseVersion

from fastapi import APIRouter, Depends, Header, Path, Request, Response
from fastapi.responses import HTMLResponse

from app.db import Session, crud, get_db
from app.dependencies import get_validated_sub, validate_dates
from app.models.user import SubscriptionUserResponse, UserResponse, UserStatus
from app.subscription.share import (
    encode_title,
    generate_subscription,
    device_limit_notice_lines,
    get_announce_text,
)
from app.templates import render_template
from config import (
    SUB_PROFILE_TITLE,
    SUB_SUPPORT_URL,
    SUB_UPDATE_INTERVAL,
    SUBSCRIPTION_PAGE_TEMPLATE,
    USE_CUSTOM_JSON_DEFAULT,
    USE_CUSTOM_JSON_FOR_HAPP,
    USE_CUSTOM_JSON_FOR_STREISAND,
    USE_CUSTOM_JSON_FOR_V2RAYN,
    USE_CUSTOM_JSON_FOR_V2RAYNG,
    XRAY_SUBSCRIPTION_PATH,
)

client_config = {
    "clash-meta": {"config_format": "clash-meta", "media_type": "text/yaml", "as_base64": False, "reverse": False},
    "sing-box": {"config_format": "sing-box", "media_type": "application/json", "as_base64": False, "reverse": False},
    "clash": {"config_format": "clash", "media_type": "text/yaml", "as_base64": False, "reverse": False},
    "v2ray": {"config_format": "v2ray", "media_type": "text/plain", "as_base64": True, "reverse": False},
    "outline": {"config_format": "outline", "media_type": "application/json", "as_base64": False, "reverse": False},
    "v2ray-json": {"config_format": "v2ray-json", "media_type": "application/json", "as_base64": False,
                   "reverse": False}
}

router = APIRouter(tags=['Subscription'], prefix=f'/{XRAY_SUBSCRIPTION_PATH}')


def get_subscription_user_info(user: UserResponse) -> dict:
    """Retrieve user subscription information including upload, download, total data, and expiry."""
    return {
        "upload": 0,
        "download": user.used_traffic,
        "total": user.data_limit if user.data_limit is not None else 0,
        "expire": user.expire if user.expire is not None else 0,
    }


def resolve_format(user_agent: str):
    """Maps a User-Agent to (config_format, media_type, as_base64, reverse).

    Replicates the per-client dispatch logic 1:1 so a single
    generate_subscription() call can serve every client.
    """
    if re.match(r'^([Cc]lash-verge|[Cc]lash[-\.]?[Mm]eta|[Ff][Ll][Cc]lash|[Mm]ihomo)', user_agent):
        return "clash-meta", "text/yaml", False, False

    elif re.match(r'^([Cc]lash|[Ss]tash)', user_agent):
        return "clash", "text/yaml", False, False

    elif re.match(r'^(SFA|SFI|SFM|SFT|[Kk]aring|[Hh]iddify[Nn]ext)', user_agent):
        return "sing-box", "application/json", False, False

    elif re.match(r'^(SS|SSR|SSD|SSS|Outline|Shadowsocks|SSconf)', user_agent):
        return "outline", "application/json", False, False

    elif (USE_CUSTOM_JSON_DEFAULT or USE_CUSTOM_JSON_FOR_V2RAYN) and re.match(r'^v2rayN/(\d+\.\d+)', user_agent):
        version_str = re.match(r'^v2rayN/(\d+\.\d+)', user_agent).group(1)
        if LooseVersion(version_str) >= LooseVersion("6.40"):
            return "v2ray-json", "application/json", False, False
        else:
            return "v2ray", "text/plain", True, False

    elif (USE_CUSTOM_JSON_DEFAULT or USE_CUSTOM_JSON_FOR_V2RAYNG) and re.match(r'^v2rayNG/(\d+\.\d+\.\d+)', user_agent):
        version_str = re.match(r'^v2rayNG/(\d+\.\d+\.\d+)', user_agent).group(1)
        if LooseVersion(version_str) >= LooseVersion("1.8.29"):
            return "v2ray-json", "application/json", False, False
        elif LooseVersion(version_str) >= LooseVersion("1.8.18"):
            return "v2ray-json", "application/json", False, True
        else:
            return "v2ray", "text/plain", True, False

    elif re.match(r'^[Ss]treisand', user_agent):
        if USE_CUSTOM_JSON_DEFAULT or USE_CUSTOM_JSON_FOR_STREISAND:
            return "v2ray-json", "application/json", False, False
        else:
            return "v2ray", "text/plain", True, False

    elif (USE_CUSTOM_JSON_DEFAULT or USE_CUSTOM_JSON_FOR_HAPP) and re.match(r'^Happ/(\d+\.\d+\.\d+)', user_agent):
        version_str = re.match(r'^Happ/(\d+\.\d+\.\d+)', user_agent).group(1)
        if LooseVersion(version_str) >= LooseVersion("1.63.1"):
            return "v2ray-json", "application/json", False, False
        else:
            return "v2ray", "text/plain", True, False

    elif re.match(r'^INCY/', user_agent, re.IGNORECASE):
        return "v2ray-json", "application/json", False, False

    else:
        return "v2ray", "text/plain", True, False


def enforce_device_limit(db: Session, dbuser, request: Request, user_agent: str) -> bool:
    """Registers/updates the requesting HWID device and enforces device_limit.

    Returns True if the request is OVER the limit (a new device beyond the
    allowed count) and should be served a notice instead of real servers.

    HWID-capable clients (Happ, v2rayTun) are tracked by x-hwid. Clients that
    don't send x-hwid (e.g. v2rayNG) are fingerprinted by user-agent so a
    single one still occupies a slot instead of bypassing the limit; multiple
    distinct UA-less clients can't be told apart and are let through.
    device_limit of 0/None means unlimited.
    """
    # Only track/enforce for users who would otherwise get real servers.
    if dbuser.status not in (UserStatus.active, UserStatus.on_hold):
        return False

    # All users are tracked (incl. unlimited, for visibility in panel/bots), but
    # last_seen writes are debounced in crud.register_user_device so repeat /sub
    # refreshes stay read-only — that, plus WAL, keeps SQLite's writer calm.
    hwid = request.headers.get("x-hwid")
    platform = request.headers.get("x-device-os")
    os_version = request.headers.get("x-ver-os")
    device_model = request.headers.get("x-device-model")

    registered, unsupported = crud.register_user_device(
        db, dbuser, hwid, platform, os_version, device_model, user_agent
    )
    # Over the limit only when a real device couldn't be registered.
    return not registered and not unsupported


@router.get("/{token}/")
@router.get("/{token}", include_in_schema=False)
def user_subscription(
    request: Request,
    db: Session = Depends(get_db),
    dbuser: UserResponse = Depends(get_validated_sub),
    user_agent: str = Header(default="")
):
    """Provides a subscription link based on the user agent (Clash, V2Ray, etc.)."""
    user: UserResponse = UserResponse.model_validate(dbuser)

    accept_header = request.headers.get("Accept", "")
    if "text/html" in accept_header:
        return HTMLResponse(
            render_template(
                SUBSCRIPTION_PAGE_TEMPLATE,
                {"user": user}
            )
        )

    crud.update_user_sub(db, dbuser, user_agent)

    over_device_limit = enforce_device_limit(db, dbuser, request, user_agent)

    response_headers = {
        "content-disposition": f'attachment; filename="{user.username}"',
        "profile-web-page-url": str(request.url),
        "support-url": SUB_SUPPORT_URL,
        "profile-title": encode_title(SUB_PROFILE_TITLE),
        "profile-update-interval": SUB_UPDATE_INTERVAL,
        "subscription-userinfo": "; ".join(
            f"{key}={val}"
            for key, val in get_subscription_user_info(user).items()
        ),
        "hide-settings": "1",
        "announce": f"base64:{base64.b64encode(get_announce_text(user).encode('utf-8')).decode('utf-8')}"
    }

    config_format, media_type, as_base64, reverse = resolve_format(user_agent)
    notice_lines = device_limit_notice_lines() if over_device_limit else None
    conf = generate_subscription(
        user=user,
        config_format=config_format,
        as_base64=as_base64,
        reverse=reverse,
        notice_lines=notice_lines,
    )
    return Response(content=conf, media_type=media_type, headers=response_headers)


@router.get("/{token}/info", response_model=SubscriptionUserResponse)
def user_subscription_info(
    dbuser: UserResponse = Depends(get_validated_sub),
):
    """Retrieves detailed information about the user's subscription."""
    return dbuser


@router.get("/{token}/usage")
def user_get_usage(
    dbuser: UserResponse = Depends(get_validated_sub),
    start: str = "",
    end: str = "",
    db: Session = Depends(get_db)
):
    """Fetches the usage statistics for the user within a specified date range."""
    start, end = validate_dates(start, end)

    usages = crud.get_user_usages(db, dbuser, start, end)

    return {"usages": usages, "username": dbuser.username}


@router.get("/{token}/{client_type}")
def user_subscription_with_client_type(
    request: Request,
    dbuser: UserResponse = Depends(get_validated_sub),
    client_type: str = Path(..., regex="sing-box|clash-meta|clash|outline|v2ray|v2ray-json"),
    db: Session = Depends(get_db),
    user_agent: str = Header(default="")
):
    """Provides a subscription link based on the specified client type (e.g., Clash, V2Ray)."""
    user: UserResponse = UserResponse.model_validate(dbuser)

    response_headers = {
        "content-disposition": f'attachment; filename="{user.username}"',
        "profile-web-page-url": str(request.url),
        "support-url": SUB_SUPPORT_URL,
        "profile-title": encode_title(SUB_PROFILE_TITLE),
        "profile-update-interval": SUB_UPDATE_INTERVAL,
        "subscription-userinfo": "; ".join(
            f"{key}={val}"
            for key, val in get_subscription_user_info(user).items()
        )
    }

    config = client_config.get(client_type)
    conf = generate_subscription(user=user,
                                 config_format=config["config_format"],
                                 as_base64=config["as_base64"],
                                 reverse=config["reverse"])

    return Response(content=conf, media_type=config["media_type"], headers=response_headers)
