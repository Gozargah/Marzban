import re

from fastapi import Response
from fastapi.responses import HTMLResponse
from packaging.version import parse

from app.db import AsyncSession
from app.db.crud import get_user_usages, update_user_sub
from app.db.models import User
from app.models.stats import Period, UserUsageStatsList
from app.models.user import UserResponse
from app.subscription.share import encode_title, generate_subscription
from app.templates import render_template
from config import (
    SUB_PROFILE_TITLE,
    SUB_SUPPORT_URL,
    SUB_UPDATE_INTERVAL,
    SUBSCRIPTION_PAGE_TEMPLATE,
    USE_CUSTOM_JSON_DEFAULT,
    USE_CUSTOM_JSON_FOR_HAPP,
    USE_CUSTOM_JSON_FOR_NPVTUNNEL,
    USE_CUSTOM_JSON_FOR_STREISAND,
    USE_CUSTOM_JSON_FOR_V2RAYN,
    USE_CUSTOM_JSON_FOR_V2RAYNG,
)

from . import BaseOperation

client_config = {
    "clash-meta": {"config_format": "clash-meta", "media_type": "text/yaml", "as_base64": False},
    "sing-box": {"config_format": "sing-box", "media_type": "application/json", "as_base64": False},
    "clash": {"config_format": "clash", "media_type": "text/yaml", "as_base64": False},
    "links-base64": {"config_format": "links", "media_type": "text/plain", "as_base64": True},
    "links": {"config_format": "links", "media_type": "text/plain", "as_base64": False},
    "outline": {"config_format": "outline", "media_type": "application/json", "as_base64": False},
    "xray": {"config_format": "xray", "media_type": "application/json", "as_base64": False},
}


class SubscriptionOperation(BaseOperation):
    @staticmethod
    def detect_client_type(user_agent: str) -> str:
        """Detect the appropriate client configuration based on the user agent."""
        # Clash Meta, FLClash, Mihomo
        if re.match(r"^([Cc]lash-verge|[Cc]lash[-\.]?[Mm]eta|[Ff][Ll][Cc]lash|[Mm]ihomo)", user_agent):
            return "clash-meta"

        # Clash, Stash
        elif re.match(r"^([Cc]lash|[Ss]tash)", user_agent):
            return "clash"

        # Sing-box clients
        elif re.match(r"^(SFA|SFI|SFM|SFT|[Kk]aring|[Hh]iddify[Nn]ext)|.*sing[-b]?ox.*", user_agent, re.IGNORECASE):
            return "sing-box"

        # Shadowsocks clients
        elif re.match(r"^(SS|SSR|SSD|SSS|Outline|Shadowsocks|SSconf)", user_agent):
            return "outline"

        # v2rayN
        elif (USE_CUSTOM_JSON_DEFAULT or USE_CUSTOM_JSON_FOR_V2RAYN) and re.match(r"^v2rayN/(\d+\.\d+)", user_agent):
            version_str = re.match(r"^v2rayN/(\d+\.\d+)", user_agent).group(1)
            if parse(version_str) >= parse("6.40"):
                return "xray"
            else:
                return "links-base64"

        # v2rayNG
        elif USE_CUSTOM_JSON_DEFAULT or USE_CUSTOM_JSON_FOR_V2RAYNG:
            version_str = re.match(r"^v2rayNG/(\d+\.\d+\.\d+)", user_agent).group(1)
            if parse(version_str) >= parse("1.8.18"):
                return "xray"
            else:
                return "links-base64"

        # Streisand
        elif re.match(r"^[Ss]treisand", user_agent):
            if USE_CUSTOM_JSON_DEFAULT or USE_CUSTOM_JSON_FOR_STREISAND:
                return "xray"
            else:
                return "links-base64"

        # Happ
        elif (USE_CUSTOM_JSON_DEFAULT or USE_CUSTOM_JSON_FOR_HAPP) and re.match(r"^Happ/(\d+\.\d+\.\d+)", user_agent):
            version_str = re.match(r"^Happ/(\d+\.\d+\.\d+)", user_agent).group(1)
            if parse(version_str) >= parse("1.11.0"):
                return "xray"
            else:
                return "links-base64"

        # NPVTunnel
        elif USE_CUSTOM_JSON_DEFAULT or USE_CUSTOM_JSON_FOR_NPVTUNNEL:
            if "ktor-client" in user_agent:
                return "xray"
            else:
                return "links-base64"

        # Default to links-base64
        else:
            return "links-base64"

    def create_response_headers(self, user: User, request_url: str) -> dict:
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
            "profile-web-page-url": request_url,
            "support-url": user.admin.support_url if user.admin and user.admin.support_url else SUB_SUPPORT_URL,
            "profile-title": encode_title(user.admin.profile_title)
            if user.admin and user.admin.profile_title
            else encode_title(SUB_PROFILE_TITLE),
            "profile-update-interval": SUB_UPDATE_INTERVAL,
            "subscription-userinfo": "; ".join(f"{key}={val}" for key, val in user_info.items()),
        }

    async def fetch_config(self, db: AsyncSession, token: str, client_type: str) -> tuple[str, str, User]:
        db_user = await self.get_validated_sub(db, token=token)

        # Get client configuration
        config = client_config.get(client_type)

        # Generate subscription content
        return (
            await generate_subscription(
                user=db_user,
                config_format=config["config_format"],
                as_base64=config["as_base64"],
            ),
            config["media_type"],
            db_user,
        )

    async def user_subscription(
        self,
        db: AsyncSession,
        token: str,
        accept_header: str = "",
        user_agent: str = "",
        request_url: str = "",
    ):
        """Provides a subscription link based on the user agent (Clash, V2Ray, etc.)."""
        # Handle HTML request (subscription page)
        if "text/html" in accept_header:
            conf, media_type, db_user = await self.fetch_config(db, token=token, client_type="links")
            template = (
                db_user.admin.sub_template
                if db_user.admin and db_user.admin.sub_template
                else SUBSCRIPTION_PAGE_TEMPLATE
            )
            return HTMLResponse(render_template(template, {"user": db_user, "links": conf.split("\n")}))
        else:
            client_type = self.detect_client_type(user_agent)
            conf, media_type, db_user = await self.fetch_config(db, token=token, client_type=client_type)

        # Update user subscription info
        db_user = await update_user_sub(db, db_user, user_agent)
        # Create response with appropriate headers
        response_headers = self.create_response_headers(db_user, request_url)
        return Response(content=conf, media_type=media_type, headers=response_headers)

    async def user_subscription_with_client_type(
        self, db: AsyncSession, token: str, client_type: str, request_url: str = ""
    ):
        """Provides a subscription link based on the specified client type (e.g., Clash, V2Ray)."""
        conf, media_type, db_user = await self.fetch_config(db, token=token, client_type=client_type)

        # Create response headers
        response_headers = self.create_response_headers(db_user, request_url)

        return Response(content=conf, media_type=media_type, headers=response_headers)

    async def user_subscription_info(self, db: AsyncSession, token: str) -> UserResponse:
        """Retrieves detailed information about the user's subscription."""
        return await self.get_validated_sub(db, token=token)

    async def get_user_usage(
        self,
        db: AsyncSession,
        token: str,
        start: str = "",
        end: str = "",
        period: Period = Period.hour,
    ) -> UserUsageStatsList:
        """Fetches the usage statistics for the user within a specified date range."""
        start, end = await self.validate_dates(start, end)

        db_user = await self.get_validated_sub(db, token=token)

        return await get_user_usages(db, db_user.id, start, end, period)
