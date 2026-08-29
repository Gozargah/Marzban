from fastapi import APIRouter, Depends, HTTPException, Query

from app.models.admin import Admin
from app.models.certificate import (CertificateCreate, CertificateList,
                                    CertificateResponse)
from app.utils import certbot, responses
from config import CERTBOT_STAGING

router = APIRouter(tags=["Certificate"], prefix="/api", responses={401: responses._401})


def _as_response(certificates) -> CertificateList:
    return CertificateList(
        enabled=certbot.is_enabled(),
        staging=CERTBOT_STAGING,
        certificates=[
            CertificateResponse(
                name=certificate.name,
                domains=certificate.domains,
                expires_at=certificate.expires_at,
                days_left=certificate.days_left,
                certificate_path=certificate.certificate_path,
                private_key_path=certificate.private_key_path,
            )
            for certificate in certificates
        ],
    )


@router.get("/certificates", response_model=CertificateList, responses={403: responses._403})
def get_certificates(admin: Admin = Depends(Admin.check_sudo_admin)):
    """List the certificates certbot manages on this host."""
    if not certbot.is_enabled():
        return _as_response([])

    try:
        return _as_response(certbot.list_certificates())
    except certbot.CertbotError as err:
        raise HTTPException(status_code=503, detail=str(err))


@router.post("/certificates", response_model=CertificateList, responses={400: responses._400, 403: responses._403})
def issue_certificate(payload: CertificateCreate, admin: Admin = Depends(Admin.check_sudo_admin)):
    """Obtain a new certificate over HTTP-01 validation."""
    try:
        certificates = certbot.issue_certificate(
            payload.domains, email=payload.email, method=payload.method, webroot=payload.webroot
        )
    except certbot.CertbotError as err:
        raise HTTPException(status_code=400, detail=str(err))

    return _as_response(certificates)


@router.post(
    "/certificates/{name}/renew",
    response_model=CertificateList,
    responses={400: responses._400, 403: responses._403},
)
def renew_certificate(
    name: str,
    force: bool = Query(
        False,
        description=(
            "Reissue even when the certificate is not due yet. Let's Encrypt allows five "
            "duplicates of the same names per week, so leave this off unless you mean it."
        ),
    ),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Renew one certificate, by default only if it is close enough to expiry."""
    try:
        return _as_response(certbot.renew_certificate(name, force=force))
    except certbot.CertbotError as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.delete(
    "/certificates/{name}",
    response_model=CertificateList,
    responses={400: responses._400, 403: responses._403},
)
def delete_certificate(name: str, admin: Admin = Depends(Admin.check_sudo_admin)):
    """Remove a certificate lineage from the host."""
    try:
        return _as_response(certbot.delete_certificate(name))
    except certbot.CertbotError as err:
        raise HTTPException(status_code=400, detail=str(err))
