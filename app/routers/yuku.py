import json

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import func

from app.db import Session, crud, get_db
from app.db.models import ProxyHost
from app.models.admin import Admin
from app.subscription.share import (
    ANNOUNCE_VARIABLES,
    DEFAULT_ANNOUNCE,
    invalidate_yuku_settings_cache,
    subscription_auto_select,
)
from app.subscription.v2ray import AUTO_SELECT_STRATEGIES, DEFAULT_AUTO_SELECT
from app.utils import audit, responses

router = APIRouter(tags=["YUKU"], prefix="/api/yuku", responses={401: responses._401})

# Known settings with their defaults. Notice texts use \n to separate lines.
DEFAULT_SETTINGS = {
    "expired_notice": "🔴 Подписка закончилась\n➡️ Продлите: t.me/yuku_vpn_bot",
    "device_limit_notice": "🔴 Превышен лимит устройств\n➡️ Поддержка: t.me/yuku_vpn_bot",
    "default_device_limit": "0",
    "announce": DEFAULT_ANNOUNCE,
    # "left" (as authored) or "center" (lines space-padded before sending)
    "announce_align": "left",
    # routing/DNS overlay for v2ray-json subscriptions: "off" or a template
    # name under app/templates/v2ray/ (ships with "yuku_routing")
    "subscription_routing": "off",
    # auto-select entries, built from the group each host is assigned to.
    # JSON list, one object per group: [{"remark", "strategy", "interval",
    # "destination"}, ...]. Empty = not configured, in which case the four keys
    # below (how the feature shipped, single-group) still describe group 1.
    "auto_select_groups": "",
    "auto_select_remark": DEFAULT_AUTO_SELECT["remark"],
    "auto_select_strategy": DEFAULT_AUTO_SELECT["strategy"],
    "auto_select_interval": DEFAULT_AUTO_SELECT["interval"],
    "auto_select_destination": DEFAULT_AUTO_SELECT["destination"],
}


def get_merged_settings(db: Session) -> dict:
    """Stored settings merged over defaults."""
    merged = dict(DEFAULT_SETTINGS)
    stored = crud.get_yuku_settings(db)
    for k, v in stored.items():
        if v is not None:
            merged[k] = v
    return merged


@router.get("/settings")
def get_settings(
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.get_current),
):
    """Get YUKU settings (notice texts, default device limit, etc.)."""
    return get_merged_settings(db)


@router.put("/settings")
def update_settings(
    values: dict = Body(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.check_sudo_admin),
):
    """Update YUKU settings. Only known keys are accepted."""
    allowed = {k: v for k, v in values.items() if k in DEFAULT_SETTINGS}
    strategy = allowed.get("auto_select_strategy")
    if strategy is not None and strategy not in AUTO_SELECT_STRATEGIES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown strategy. Available: {', '.join(AUTO_SELECT_STRATEGIES)}",
        )
    if "auto_select_groups" in allowed:
        allowed["auto_select_groups"] = _validate_auto_select_groups(
            db, allowed["auto_select_groups"]
        )
    if allowed:
        current = get_merged_settings(db)
        audit.detail(
            target_name=",".join(sorted(allowed)),
            before={k: current.get(k) for k in allowed},
            after=dict(allowed),
        )
        crud.set_yuku_settings(db, allowed)
        # subscription reads settings through a 30s cache; drop it so the new
        # announce/notice text applies to the very next /sub request
        invalidate_yuku_settings_cache()
    return get_merged_settings(db)


def _validate_auto_select_groups(db: Session, value) -> str:
    """Normalises the group list to the JSON string that gets stored.

    Accepts either a list (what the panel sends) or an already-encoded string.
    """
    if value in (None, "", []):
        groups = []
    else:
        if isinstance(value, str):
            try:
                groups = json.loads(value)
            except ValueError:
                raise HTTPException(status_code=400, detail="auto_select_groups is not valid JSON")
        else:
            groups = value
        if not isinstance(groups, list):
            raise HTTPException(status_code=400, detail="auto_select_groups must be a list")

    cleaned = []
    for i, group in enumerate(groups, start=1):
        if not isinstance(group, dict):
            raise HTTPException(status_code=400, detail=f"Group {i} is not an object")
        strategy = (group.get("strategy") or "").strip()
        if strategy and strategy not in AUTO_SELECT_STRATEGIES:
            raise HTTPException(
                status_code=400,
                detail=f"Group {i}: unknown strategy. Available: {', '.join(AUTO_SELECT_STRATEGIES)}",
            )
        cleaned.append({
            key: str(group.get(key) or "").strip()
            for key in ("remark", "strategy", "interval", "destination")
        })

    # A host pointing at a group that no longer exists would quietly vanish from
    # every auto-select entry, so removing a group in use is refused instead.
    highest = db.query(func.max(ProxyHost.auto_select)).scalar() or 0
    if highest > len(cleaned):
        raise HTTPException(
            status_code=400,
            detail=(f"Есть хосты в автовыборе №{highest} — сначала переназначьте их "
                    f"в настройках хостов, потом удаляйте группу"),
        )

    encoded = json.dumps(cleaned, ensure_ascii=False) if cleaned else ""
    if len(encoded) > 4096:
        raise HTTPException(status_code=400, detail="Too many auto-select groups")
    return encoded


@router.get("/auto-select")
def auto_select(
    db: Session = Depends(get_db),
    admin: Admin = Depends(Admin.get_current),
):
    """Auto-select groups as the subscription sees them, plus what's on offer.

    The hosts dialog uses `groups` to label its group picker, so both screens
    always agree on how many groups exist and what they are called.
    """
    return {
        "groups": subscription_auto_select(),
        "strategies": list(AUTO_SELECT_STRATEGIES),
        "defaults": DEFAULT_AUTO_SELECT,
        "in_use": db.query(func.max(ProxyHost.auto_select)).scalar() or 0,
    }


@router.get("/announce-variables")
def announce_variables(admin: Admin = Depends(Admin.get_current)):
    """Template variables available in the announce text."""
    return {"variables": list(ANNOUNCE_VARIABLES)}
