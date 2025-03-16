import re
from distutils.version import LooseVersion

from fastapi import APIRouter, Depends, Header, Path, Request, Response
from fastapi.responses import HTMLResponse

from app.db import Session, crud, get_db
from app.dependencies import get_validated_sub, validate_dates
from app.models.user import SubscriptionUserResponse, UserResponse
from app.subscription.share import encode_title, generate_subscription
from app.templates import render_template
from config import (
    SUB_PROFILE_TITLE,
    SUB_SUPPORT_URL,
    SUB_UPDATE_INTERVAL,
    SUBSCRIPTION_PAGE_TEMPLATE,
    USE_CUSTOM_JSON_DEFAULT,
    USE_CUSTOM_JSON_FOR_HAPP,
    USE_CUSTOM_JSON_FOR_STREISAND,
    USE_CUSTOM_JSON_FOR_NPVTUNNEL,
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
    "v2ray-json": {
        "config_format": "v2ray-json",
        "media_type": "application/json",
        "as_base64": False,
        "reverse": False,
    },
}

router = APIRouter(tags=["Subscription"], prefix=f"/{XRAY_SUBSCRIPTION_PATH}")


def detect_client_config(user_agent: str) -> dict:
    """Detect the appropriate client configuration based on the user agent."""
    # Clash Meta, FLClash, Mihomo
    if re.match(r"^([Cc]lash-verge|[Cc]lash[-\.]?[Mm]eta|[Ff][Ll][Cc]lash|[Mm]ihomo)", user_agent):
        return client_config["clash-meta"]
    
    # Clash, Stash
    elif re.match(r"^([Cc]lash|[Ss]tash)", user_agent):
        return client_config["clash"]
    
    # Sing-box clients
    elif re.match(r"^(SFA|SFI|SFM|SFT|[Kk]aring|[Hh]iddify[Nn]ext)", user_agent):
        return client_config["sing-box"]
    
    # Shadowsocks clients
    elif re.match(r"^(SS|SSR|SSD|SSS|Outline|Shadowsocks|SSconf)", user_agent):
        return client_config["outline"]
    
    # v2rayN
    elif (USE_CUSTOM_JSON_DEFAULT or USE_CUSTOM_JSON_FOR_V2RAYN) and re.match(r"^v2rayN/(\d+\.\d+)", user_agent):
        version_str = re.match(r"^v2rayN/(\d+\.\d+)", user_agent).group(1)
        if LooseVersion(version_str) >= LooseVersion("6.40"):
            return client_config["v2ray-json"]
        else:
            return client_config["v2ray"]
    
    # v2rayNG
    elif (USE_CUSTOM_JSON_DEFAULT or USE_CUSTOM_JSON_FOR_V2RAYNG) and re.match(r"^v2rayNG/(\d+\.\d+\.\d+)", user_agent):
        version_str = re.match(r"^v2rayNG/(\d+\.\d+\.\d+)", user_agent).group(1)
        if LooseVersion(version_str) >= LooseVersion("1.8.29"):
            return client_config["v2ray-json"]
        elif LooseVersion(version_str) >= LooseVersion("1.8.18"):
            return {**client_config["v2ray-json"], "reverse": True}
        else:
            return client_config["v2ray"]
    
    # Streisand
    elif re.match(r"^[Ss]treisand", user_agent):
        if USE_CUSTOM_JSON_DEFAULT or USE_CUSTOM_JSON_FOR_STREISAND:
            return client_config["v2ray-json"]
        else:
            return client_config["v2ray"]
    
    # Happ
    elif (USE_CUSTOM_JSON_DEFAULT or USE_CUSTOM_JSON_FOR_HAPP) and re.match(r"^Happ/(\d+\.\d+\.\d+)", user_agent):
        version_str = re.match(r"^Happ/(\d+\.\d+\.\d+)", user_agent).group(1)
        if LooseVersion(version_str) >= LooseVersion("1.11.0"):
            return client_config["v2ray-json"]
        else:
            return client_config["v2ray"]
    
    # NPVTunnel
    elif USE_CUSTOM_JSON_DEFAULT or USE_CUSTOM_JSON_FOR_NPVTUNNEL:
        if "ktor-client" in user_agent:
            return client_config["v2ray-json"]
        else:
            return client_config["v2ray"]
    
    # Default to v2ray
    else:
        return client_config["v2ray"]


def create_response_headers(user: UserResponse, request: Request) -> dict:
    """Create response headers for subscription responses, including user subscription info."""
    # Generate user subscription info
    user_info = {
        "upload": 0,
        "download": user.used_traffic,
        "total": user.data_limit if user.data_limit is not None else 0,
        "expire": user.expire if user.expire is not None else 0,
    }
    
    # Create and return headers
    return {
        "content-disposition": f'attachment; filename="{user.username}"',
        "profile-web-page-url": str(request.url),
        "support-url": user.admin.support_url if user.admin and user.admin.support_url else SUB_SUPPORT_URL,
        "profile-title": encode_title(user.admin.profile_title)
        if user.admin and user.admin.profile_title
        else encode_title(SUB_PROFILE_TITLE),
        "profile-update-interval": SUB_UPDATE_INTERVAL,
        "subscription-userinfo": "; ".join(f"{key}={val}" for key, val in user_info.items()),
    }


@router.get("/{token}/")
@router.get("/{token}", include_in_schema=False)
async def user_subscription(
    request: Request,
    db: Session = Depends(get_db),
    dbuser: UserResponse = Depends(get_validated_sub),
    user_agent: str = Header(default=""),
):
    """Provides a subscription link based on the user agent (Clash, V2Ray, etc.)."""
    user: UserResponse = UserResponse.model_validate(dbuser)

    # Handle HTML request (subscription page)
    accept_header = request.headers.get("Accept", "")
    if "text/html" in accept_header:
        links = generate_subscription(user=user, config_format="v2ray", as_base64=False, reverse=False)
        template = user.admin.sub_template if user.admin and user.admin.sub_template else SUBSCRIPTION_PAGE_TEMPLATE
        return HTMLResponse(render_template(template, {"user": user, "links": links.split("\n")}))

    # Update user subscription info
    crud.update_user_sub(db, dbuser, user_agent)
    
    # Get appropriate client configuration based on user agent
    config = detect_client_config(user_agent)
    
    # Generate subscription content
    conf = generate_subscription(
        user=user, 
        config_format=config["config_format"], 
        as_base64=config["as_base64"], 
        reverse=config["reverse"]
    )
    
    # Create response with appropriate headers
    response_headers = create_response_headers(user, request)
    return Response(content=conf, media_type=config["media_type"], headers=response_headers)


@router.get("/{token}/info", response_model=SubscriptionUserResponse)
async def user_subscription_info(
    dbuser: UserResponse = Depends(get_validated_sub),
):
    """Retrieves detailed information about the user's subscription."""
    return dbuser


@router.get("/{token}/usage")
async def user_get_usage(
    dbuser: UserResponse = Depends(get_validated_sub), start: str = "", end: str = "", db: Session = Depends(get_db)
):
    """Fetches the usage statistics for the user within a specified date range."""
    start, end = validate_dates(start, end)

    usages = crud.get_user_usages(db, dbuser, start, end)

    return {"usages": usages, "username": dbuser.username}


@router.get("/{token}/{client_type}")
async def user_subscription_with_client_type(
    request: Request,
    dbuser: UserResponse = Depends(get_validated_sub),
    client_type: str = Path(..., regex="sing-box|clash-meta|clash|outline|v2ray|v2ray-json"),
    db: Session = Depends(get_db),
    user_agent: str = Header(default=""),
):
    """Provides a subscription link based on the specified client type (e.g., Clash, V2Ray)."""
    user: UserResponse = UserResponse.model_validate(dbuser)

    # Create response headers
    response_headers = create_response_headers(user, request)

    # Get client configuration
    config = client_config.get(client_type)
    
    # Generate subscription content
    conf = generate_subscription(
        user=user, 
        config_format=config["config_format"], 
        as_base64=config["as_base64"], 
        reverse=config["reverse"]
    )

    return Response(content=conf, media_type=config["media_type"], headers=response_headers)
