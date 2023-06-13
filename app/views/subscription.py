import os
import re

from fastapi import Depends, Header, Request, Response
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app import app
from app.db import Session, crud, get_db
from app.models.user import UserResponse, UserStatus
from app.templates import render_template
from app.utils.jwt import get_subscription_payload
from app.utils.share import generate_subscription
from config import SUBSCRIPTION_PAGE_TEMPLATE
from config import SUBSCRIPTION_PAGE_LANG


@app.get("/sub/{token}/", tags=['Subscription'])
@app.get("/sub/{token}", include_in_schema=False)
def user_subcription(token: str,
                     request: Request,
                     db: Session = Depends(get_db),
                     user_agent: str = Header(default="")):
    """
    Subscription link, V2ray and Clash supported
    """
    accept_header = request.headers.get("Accept", "")

    def get_subscription_user_info(user: UserResponse) -> dict:
        return {
            "upload": 0,
            "download": user.used_traffic,
            "total": user.data_limit,
            "expire": user.expire,
        }

    sub = get_subscription_payload(token)
    if not sub:
        return Response(status_code=204)

    dbuser = crud.get_user(db, sub['username'])
    if not dbuser or dbuser.created_at > sub['created_at']:
        return Response(status_code=204)

    user: UserResponse = UserResponse.from_orm(dbuser)

    if "text/html" in accept_header:
        static_directory = os.path.join(os.path.dirname(os.path.abspath(__file__)).replace("/view", "/template"), "subscription")
        app.mount("/static", StaticFiles(directory=static_directory), name="static")
        return HTMLResponse(
            render_template(
                SUBSCRIPTION_PAGE_TEMPLATE,
                {"user": user, "lang": SUBSCRIPTION_PAGE_LANG}
            )
        )

    if not user.status == UserStatus.active:
        return Response(status_code=443)

    response_headers = {
        "content-disposition": f'attachment; filename="{user.username}"',
        "profile-update-interval": "12",
        "subscription-userinfo": "; ".join(
            f"{key}={val}"
            for key, val in get_subscription_user_info(user).items()
            if val is not None
        )
    }

    if re.match('^([Cc]lash-verge|[Cc]lash-?[Mm]eta)', user_agent):
        conf = generate_subscription(user=user, config_format="clash-meta", as_base64=False)
        return Response(content=conf, media_type="text/yaml", headers=response_headers)

    elif re.match('^([Cc]lash|[Ss]tash)', user_agent):
        conf = generate_subscription(user=user, config_format="clash", as_base64=False)
        return Response(content=conf, media_type="text/yaml", headers=response_headers)

    else:
        conf = generate_subscription(user=user, config_format="v2ray", as_base64=True)
        return Response(content=conf, media_type="text/plain", headers=response_headers)


@app.get("/sub/{token}/info", tags=['Subscription'], response_model=UserResponse)
def user_subcription_info(token: str,
                          db: Session = Depends(get_db)):
    sub = get_subscription_payload(token)
    if not sub:
        return Response(status_code=404)

    dbuser = crud.get_user(db, sub['username'])
    if not dbuser or dbuser.created_at > sub['created_at']:
        return Response(status_code=404)

    return dbuser
