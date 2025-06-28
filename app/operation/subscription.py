import re
from datetime import datetime as dt

from fastapi import Response
from fastapi.responses import HTMLResponse

from app.db import AsyncSession
from app.db.crud.user import get_user_usages, update_user_sub
from app.db.models import User
from app.models.stats import Period, UserUsageStatsList
from app.models.user import UserResponse
from app.models.settings import ConfigFormat, SubRule, Subscription as SubSettings
from app.settings import subscription_settings
from app.subscription.share import encode_title, generate_subscription
from app.templates import render_template
from config import SUBSCRIPTION_PAGE_TEMPLATE

from . import BaseOperation

client_config = {
    ConfigFormat.clash_meta: {"config_format": "clash-meta", "media_type": "text/yaml", "as_base64": False},
    ConfigFormat.clash: {"config_format": "clash", "media_type": "text/yaml", "as_base64": False},
    ConfigFormat.sing_box: {"config_format": "sing-box", "media_type": "application/json", "as_base64": False},
    ConfigFormat.links_base64: {"config_format": "links", "media_type": "text/plain", "as_base64": True},
    ConfigFormat.links: {"config_format": "links", "media_type": "text/plain", "as_base64": False},
    ConfigFormat.outline: {"config_format": "outline", "media_type": "application/json", "as_base64": False},
    ConfigFormat.xray: {"config_format": "xray", "media_type": "application/json", "as_base64": False},
}


class SubscriptionOperation(BaseOperation):
    @staticmethod
    async def detect_client_type(user_agent: str, rules: list[SubRule]) -> ConfigFormat | None:
        """Detect the appropriate client configuration based on the user agent."""
        for rule in rules:
            if re.match(rule.pattern, user_agent):
                return rule.target

    @staticmethod
    def create_response_headers(user: User, request_url: str, sub_settings: SubSettings) -> dict:
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
            "support-url": user.admin.support_url
            if user.admin and user.admin.support_url
            else sub_settings.support_url,
            "profile-title": encode_title(user.admin.profile_title)
            if user.admin and user.admin.profile_title
            else encode_title(sub_settings.profile_title),
            "profile-update-interval": str(sub_settings.update_interval),
            "subscription-userinfo": "; ".join(f"{key}={val}" for key, val in user_info.items()),
        }

    async def fetch_config(self, db: AsyncSession, token: str, client_type: ConfigFormat) -> tuple[str, str, User]:
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
        sub_settings: SubSettings = await subscription_settings()

        if "text/html" in accept_header:
            conf, media_type, db_user = await self.fetch_config(db, token=token, client_type=ConfigFormat.links)
            template = (
                db_user.admin.sub_template
                if db_user.admin and db_user.admin.sub_template
                else SUBSCRIPTION_PAGE_TEMPLATE
            )
            return HTMLResponse(render_template(template, {"user": db_user, "links": conf.split("\n")}))
        else:
            client_type = await self.detect_client_type(user_agent, sub_settings.rules)
            if client_type == ConfigFormat.block or not client_type:
                await self.raise_error(message="Client not supported", code=406)

            conf, media_type, db_user = await self.fetch_config(db, token=token, client_type=client_type)

        # Update user subscription info
        db_user = await update_user_sub(db, db_user, user_agent)
        # Create response with appropriate headers
        response_headers = self.create_response_headers(db_user, request_url, sub_settings)
        return Response(content=conf, media_type=media_type, headers=response_headers)

    async def user_subscription_with_client_type(
        self, db: AsyncSession, token: str, client_type: ConfigFormat, request_url: str = ""
    ):
        """Provides a subscription link based on the specified client type (e.g., Clash, V2Ray)."""
        sub_settings: SubSettings = await subscription_settings()

        if client_type == ConfigFormat.block or not getattr(sub_settings.manual_sub_request, client_type):
            await self.raise_error(message="Client not supported", code=406)

        conf, media_type, db_user = await self.fetch_config(db, token=token, client_type=client_type)

        # Create response headers
        response_headers = self.create_response_headers(db_user, request_url, sub_settings)

        return Response(content=conf, media_type=media_type, headers=response_headers)

    async def user_subscription_info(self, db: AsyncSession, token: str) -> UserResponse:
        """Retrieves detailed information about the user's subscription."""
        return await self.get_validated_sub(db, token=token)

    async def get_user_usage(
        self,
        db: AsyncSession,
        token: str,
        start: dt = None,
        end: dt = None,
        period: Period = Period.hour,
    ) -> UserUsageStatsList:
        """Fetches the usage statistics for the user within a specified date range."""
        start, end = await self.validate_dates(start, end)

        db_user = await self.get_validated_sub(db, token=token)

        return await get_user_usages(db, db_user.id, start, end, period)
