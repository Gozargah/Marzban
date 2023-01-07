
from typing import Union

from app import app
from app.db import Session, crud, get_db
from app.models.user import UserResponse
from app.utils.jwt import get_subscription_payload
from app.utils.share import get_clash_sub, get_v2ray_sub
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

    if application.startswith('Clash'):
        conf = get_clash_sub(user.username, user.proxies).to_yaml()
        return Response(content=conf, media_type="text/yaml",
                        headers={"content-disposition": f'attachment; filename="{user.username}"'})
    else:
        conf = get_v2ray_sub(user.links)
        return Response(content=conf, media_type="text/plain",
                        headers={"content-disposition": f'attachment; filename="{user.username}"'})
