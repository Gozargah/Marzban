from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Cookie
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional

from app import app
from app.db import get_db, Admin, get_admin, verify_admin, update_admin_login_attempt
from app.models.admin import AdminCreate, AdminModify, AdminResponse
from app.utils.jwt import create_admin_token, get_admin_payload, revoke_token
from config import DOCS_URL

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[],
)


@router.post("/token")
def admin_token(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    admin = verify_admin(db, form_data.username, form_data.password)
    if not admin:
        update_admin_login_attempt(db, form_data.username, False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    update_admin_login_attempt(db, form_data.username, True)
    access_token = create_admin_token(admin.username, admin.is_sudo)
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        samesite='strict'
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout")
def admin_logout(
    request: Request,
    response: Response,
    token: Optional[str] = Cookie(None, alias="access_token"),
    admin: Admin = Depends(get_admin),
):
    if token and token.startswith("Bearer "):
        token = token[7:]
        revoke_token(token)
    
    response.delete_cookie(key="access_token")
    return {"detail": "You have successfully logged out"}


if DOCS_URL:
    @app.get("/docs/oauth2-redirect")
    async def oauth2_redirect():
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Authentication Complete</title>
            <script>
                'use strict';
                function parse(search) {
                    var result = {};
                    search = search.substring(1);
                    var params = search.split("&");
                    for (var i = 0; i < params.length; i++) {
                        var param = params[i].split("=");
                        result[param[0]] = decodeURIComponent(param[1]);
                    }
                    return result;
                }

                var oauth2 = window.opener.swaggerUIRedirectOauth2;
                var sentState = oauth2.state;
                var redirectUrl = oauth2.redirectUrl;
                var isValid, qp, arr;

                qp = parse(window.location.search.substring(1));
                arr = {
                    code: qp.code,
                    state: qp.state
                };
                isValid = qp.state === sentState;

                if (isValid) {
                    window.opener.location.reload();
                    window.close();
                }
            </script>
        </head>
        <body>
            <h3>Authentication Complete</h3>
            <p>You can close this window</p>
        </body>
        </html>
        """ 
