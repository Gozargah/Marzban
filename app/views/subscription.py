
from typing import Union

from app import app
from app.db import Session, crud, get_db
from app.models.user import UserResponse
from app.utils.jwt import get_subscription_payload
from app.utils.share import (generate_clash_subscription,
                             generate_v2ray_subscription)
from fastapi import Depends, Header, Response


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

    response_headers = {
        "content-disposition": f'attachment; filename="{user.username}"',
        "profile-update-interval": "12",
        "subscription-userinfo": f"upload=0; download={user.used_traffic}; total={user.data_limit}; expire={user.expire}"
    }

    if application.startswith('Clash'):
        conf = generate_clash_subscription(user.proxies, user.inbounds, user.dict())
        return Response(content=conf, media_type="text/yaml", headers=response_headers)

    else:
        conf = generate_v2ray_subscription(user.links)
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
