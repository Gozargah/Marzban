
import math
from typing import Union

from app import app
from app.db import Session, crud, get_db
from app.models.user import UserResponse
from app.utils.jwt import get_subscription_payload
from app.utils.share import get_clash_sub, get_v2ray_sub
from fastapi import Depends, Header, Response


def format_bytes(bytes, decimals=2):
    if not bytes:
        return "0 B"

    k = 1024
    dm = decimals if decimals >= 0 else 0
    sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]

    i = int(math.floor(math.log(bytes) / math.log(k)))

    return "{:.{}f} {}".format(bytes / (k ** i), dm, sizes[i])


@app.get("/sub/{token}/", tags=['Subscription'])
@app.get("/sub/{token}", include_in_schema=False)
def user_subcription(token: str,
                     db: Session = Depends(get_db),
                     user_agent: Union[str, None] = Header(default=None)):
    """
    Subscription link, V2ray and Clash supported
    """

    application = user_agent.split('/')[0]

    sub = get_subscription_payload(token)
    if not sub:
        return Response(status_code=204)

    dbuser = crud.get_user(db, sub['username'])
    if not dbuser or dbuser.created_at > sub['created_at']:
        return Response(status_code=204)
    user = UserResponse.from_orm(dbuser)

    if application.startswith('Clash'):
        conf = get_clash_sub(user.username, user.proxies).to_yaml()
        return Response(content=conf, media_type="text/yaml",
                        headers={
                            "content-disposition": f'attachment; filename="{user.username}"',
                            "profile-update-interval": "24",
                            "subscription-userinfo": f"upload={(user.used_traffic)}; download=0; total={(user.data_limit)}; expire={user.expire}",
                        })
    else:
        conf = get_v2ray_sub(user.links)
        uri: str = f"STATUS=🚀↑↓:{format_bytes(user.used_traffic)}/{format_bytes(user.data_limit)}|💡Expires:{user.expire}\r\n"
        return Response(content=conf, media_type="text/plain",
                        headers={
                            "profile-update-interval": "24",
                            "subscription-userinfo": f"upload={(user.used_traffic)}; download=0; total={(user.data_limit)}; expire={user.expire}",
                            "content-disposition": f'attachment; filename="{user.username}"'
                        })
