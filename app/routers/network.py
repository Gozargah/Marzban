"""Kernel tunables and the profiles that group them.

Sudo only, and inert until SYSCTL_ENABLED is set: everything here writes to
the host's kernel, which is a good deal further than the rest of the API
reaches. The response always carries whether writing is possible and why not,
so the dashboard can render the screen read-only rather than failing per key.
"""

import json
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError

from app.db import Session, crud, get_db
from app.models.admin import Admin
from app.models.network import (LimitsApplyResult, LimitsSnippet,
                                NetworkApplyResult, NetworkInterface,
                                NetworkProfileCreate, NetworkProfileModify,
                                NetworkProfileResponse, NetworkSection,
                                NetworkSettings, NetworkSettingsModify,
                                ResourceLimit, ResourceLimits, TunableFailure,
                                TunableResponse)
from app.utils import limits as rlimits
from app.utils import responses, sysctl
from app.utils.sysctl_catalog import BASELINE, TUNABLES, section_titles
from app.utils.system import network_interfaces

router = APIRouter(tags=["Network"], prefix="/api", responses={401: responses._401})


def _current_settings() -> NetworkSettings:
    values = sysctl.effective_values()
    writable, reason = sysctl.writable()

    sections = []
    for section, title in section_titles():
        entries = [
            TunableResponse(
                key=tunable.key,
                kind=tunable.kind,
                description=tunable.description,
                baseline=tunable.baseline,
                value=values[tunable.key],
                customised=values[tunable.key] != tunable.baseline,
            )
            for tunable in TUNABLES
            if tunable.section == section
        ]
        sections.append(NetworkSection(id=section, title=title, settings=entries))

    return NetworkSettings(
        enabled=sysctl.is_enabled(),
        writable=writable,
        reason=reason,
        managed_file=sysctl.conf_path(),
        sections=sections,
        interfaces=[
            NetworkInterface(
                name=interface.name,
                mac=interface.mac,
                mtu=interface.mtu,
                addresses=interface.addresses or [],
            )
            for interface in network_interfaces()
        ],
    )


def _validated(settings: Dict[str, str]) -> Dict[str, str]:
    try:
        return sysctl.validate_many(settings)
    except sysctl.SysctlError as err:
        raise HTTPException(status_code=400, detail=str(err))


def _apply(settings: Dict[str, str]) -> NetworkApplyResult:
    """Apply a full set of values, reporting per-key refusals rather than failing.

    The kernel can accept most of a set and refuse the rest — an unloaded
    conntrack module, a parameter a container may not touch — and an admin
    needs to see which, not a single error for the whole request.
    """
    try:
        result = sysctl.apply(settings)
    except sysctl.SysctlError as err:
        raise HTTPException(status_code=400, detail=str(err))

    return NetworkApplyResult(
        applied=sorted(result.applied),
        failed=[TunableFailure(key=key, message=message) for key, message in result.failed],
        settings=_current_settings(),
    )


@router.get("/network", response_model=NetworkSettings, responses={403: responses._403})
def get_network_settings(admin: Admin = Depends(Admin.check_sudo_admin)):
    """The kernel parameters the panel manages, with their live values."""
    return _current_settings()


@router.put(
    "/network",
    response_model=NetworkApplyResult,
    responses={400: responses._400, 403: responses._403},
)
def modify_network_settings(
    modified: NetworkSettingsModify, admin: Admin = Depends(Admin.check_sudo_admin)
):
    """Write the given parameters to the managed file and apply them."""
    return _apply(_validated(modified.settings))


@router.post(
    "/network/reset",
    response_model=NetworkApplyResult,
    responses={400: responses._400, 403: responses._403},
)
def reset_network_settings(admin: Admin = Depends(Admin.check_sudo_admin)):
    """Put every managed parameter back to the tuning the panel ships with."""
    return _apply(dict(BASELINE))


@router.get(
    "/network/profiles",
    response_model=List[NetworkProfileResponse],
    responses={403: responses._403},
)
def get_network_profiles(
    db: Session = Depends(get_db), admin: Admin = Depends(Admin.check_sudo_admin)
):
    """Saved sets of parameters, the built-in one first."""
    return crud.get_network_profiles(db)


@router.post(
    "/network/profiles",
    response_model=NetworkProfileResponse,
    responses={400: responses._400, 403: responses._403, 409: responses._409},
)
def create_network_profile(
    profile: NetworkProfileCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Save a profile. With no settings given, the running ones are captured."""
    settings = _validated(profile.settings) if profile.settings else sysctl.effective_values()

    try:
        return crud.create_network_profile(db, profile, settings)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A profile with that name already exists")


def _editable_profile(profile_id: int, db: Session):
    dbprofile = crud.get_network_profile(db, profile_id)
    if not dbprofile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if dbprofile.builtin:
        raise HTTPException(
            status_code=403,
            detail="The built-in profile cannot be changed. Save a copy under a new name instead.",
        )
    return dbprofile


@router.put(
    "/network/profiles/{profile_id}",
    response_model=NetworkProfileResponse,
    responses={400: responses._400, 403: responses._403, 404: responses._404, 409: responses._409},
)
def modify_network_profile(
    profile_id: int,
    modified: NetworkProfileModify,
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Rename a profile, redescribe it, or replace the settings it holds."""
    dbprofile = _editable_profile(profile_id, db)
    settings = _validated(modified.settings) if modified.settings is not None else None

    try:
        return crud.update_network_profile(db, dbprofile, modified, settings)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A profile with that name already exists")


@router.delete(
    "/network/profiles/{profile_id}",
    responses={403: responses._403, 404: responses._404},
)
def remove_network_profile(
    profile_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Delete a profile. The parameters it set stay as they are."""
    crud.remove_network_profile(db, _editable_profile(profile_id, db))
    return {"detail": "Profile removed successfully"}


@router.post(
    "/network/profiles/{profile_id}/apply",
    response_model=NetworkApplyResult,
    responses={400: responses._400, 403: responses._403, 404: responses._404},
)
def apply_network_profile(
    profile_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Apply everything a profile holds."""
    dbprofile = crud.get_network_profile(db, profile_id)
    if not dbprofile:
        raise HTTPException(status_code=404, detail="Profile not found")

    return _apply(_validated(dbprofile.settings))


def _snippets() -> List[LimitsSnippet]:
    """The host files this feature manages, plus the compose block for the panel.

    Handed to the dashboard verbatim so an admin can apply them by hand: none
    of them mean anything until something restarts, and the panel restarts
    neither itself nor the daemon running it.
    """
    from config import (ULIMIT_DOCKER_DAEMON_PATH, ULIMIT_LIMITS_CONF_PATH,
                        ULIMIT_SYSTEMD_CONF_PATH)

    return [
        LimitsSnippet(
            path=ULIMIT_LIMITS_CONF_PATH,
            content=rlimits.limits_conf(),
            restart=rlimits.RESTART_NOTES["limits"],
        ),
        LimitsSnippet(
            path=ULIMIT_SYSTEMD_CONF_PATH,
            content=rlimits.systemd_conf(),
            restart=rlimits.RESTART_NOTES["systemd"],
        ),
        LimitsSnippet(
            path=ULIMIT_DOCKER_DAEMON_PATH,
            content=json.dumps({"default-ulimits": rlimits.docker_ulimits()}, indent=2) + "\n",
            restart=rlimits.RESTART_NOTES["docker"],
        ),
        LimitsSnippet(
            path="docker-compose.yml",
            content=rlimits.compose_snippet(),
            restart="run `xenith restart` (or `docker compose up -d`) to pick it up",
        ),
    ]


def _current_limits() -> ResourceLimits:
    return ResourceLimits(
        enabled=rlimits.is_enabled(),
        reason=rlimits.writable(),
        kernel_ceiling=rlimits.kernel_nr_open(),
        target=rlimits.nofile_target(),
        limits=[
            ResourceLimit(
                name=limit.name,
                soft=limit.soft,
                hard=limit.hard,
                target=limit.target,
                managed=limit.managed,
                at_target=limit.at_target,
            )
            for limit in rlimits.read_limits()
        ],
        snippets=_snippets(),
    )


@router.get("/network/limits", response_model=ResourceLimits, responses={403: responses._403})
def get_resource_limits(admin: Admin = Depends(Admin.check_sudo_admin)):
    """The panel's own resource limits, and what the host still needs."""
    return _current_limits()


@router.post(
    "/network/limits/raise",
    response_model=LimitsApplyResult,
    responses={400: responses._400, 403: responses._403},
)
def raise_resource_limits(admin: Admin = Depends(Admin.check_sudo_admin)):
    """Raise the limits to the maximum: this process now, the host on disk.

    The panel's own descriptor limit moves immediately. The host files are
    written only when ULIMIT_ENABLED is set, and each one is reported with the
    restart it still needs — nothing here restarts Docker or the panel.
    """
    try:
        report = rlimits.apply_host_limits()
    except rlimits.LimitsError as err:
        # Even with the host files unavailable, this process can still be lifted.
        own = rlimits.raise_own_limits()
        if not own.raised:
            raise HTTPException(status_code=400, detail=str(err))
        report = own
        report.problems.append(str(err))

    written = [
        LimitsSnippet(path=path, content="", restart=restart)
        for path, restart in report.written.items()
    ]

    return LimitsApplyResult(
        raised=report.raised,
        written=written,
        problems=report.problems,
        limits=_current_limits(),
    )
