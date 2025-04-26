from fastapi import APIRouter, Depends, status

from app.db import AsyncSession, get_db
from app.models.admin import AdminDetails
from app.models.host import BaseHost, CreateHost
from app.operation import OperatorType
from app.operation.host import HostOperation
from app.utils import responses

from .authentication import check_sudo_admin

host_operator = HostOperation(operator_type=OperatorType.API)
router = APIRouter(tags=["Host"], prefix="/api/host", responses={401: responses._401, 403: responses._403})


@router.get("/{host_id}", response_model=BaseHost)
async def get_host(host_id: int, db: AsyncSession = Depends(get_db), _: AdminDetails = Depends(check_sudo_admin)):
    """
    get host by **id**
    """
    return await host_operator.get_validated_host(db=db, host_id=host_id)


@router.get("s", response_model=list[BaseHost])
async def get_hosts(
    offset: int = 0, limit: int = 0, db: AsyncSession = Depends(get_db), _: AdminDetails = Depends(check_sudo_admin)
):
    """
    Get proxy hosts.
    """
    return await host_operator.get_hosts(db=db, offset=offset, limit=limit)


@router.post("/", response_model=BaseHost, status_code=status.HTTP_201_CREATED)
async def create_host(
    new_host: CreateHost, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(check_sudo_admin)
):
    """
    create a new host

    **inbound_tag** must be available in one of xray config
    """
    return await host_operator.create_host(db, new_host=new_host, admin=admin)


@router.put("/{host_id}", response_model=BaseHost, responses={404: responses._404})
async def modify_host(
    host_id: int,
    modified_host: CreateHost,
    db: AsyncSession = Depends(get_db),
    admin: AdminDetails = Depends(check_sudo_admin),
):
    """
    modify host by **id**

    **inbound_tag** must be available in one of xray configs
    """
    return await host_operator.modify_host(db, host_id=host_id, modified_host=modified_host, admin=admin)


@router.delete(
    "/{host_id}",
    responses={404: responses._404},
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_host(
    host_id: int, db: AsyncSession = Depends(get_db), admin: AdminDetails = Depends(check_sudo_admin)
):
    """
    remove host by **id**
    """
    await host_operator.remove_host(db, host_id=host_id, admin=admin)
    return {}


@router.put("s", response_model=list[BaseHost])
async def modify_hosts(
    modified_hosts: list[CreateHost],
    db: AsyncSession = Depends(get_db),
    admin: AdminDetails = Depends(check_sudo_admin),
):
    """
    Modify proxy hosts and update the configuration.
    """
    return await host_operator.modify_hosts(db=db, modified_hosts=modified_hosts, admin=admin)
