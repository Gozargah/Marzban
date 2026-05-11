import base64
import os
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.models.admin import Admin
from app.utils import responses

CADDY_LOG = os.environ.get("CADDY_LOG", "/var/log/caddy/access.log")

router = APIRouter(tags=["Devices"], prefix="/api", responses={401: responses._401})

# ---- cache -----------------------------------------------------------------
_cache_result: Optional[dict] = None
_cache_minutes: int = 0
_cache_ts: float = 0.0
_CACHE_TTL = 60  # seconds
# ---- Telegram alert dedup persisted in memory (same as old sidecar) --------
_alerted_suspicious: set = set()


def _send_telegram(message: str) -> None:
    import json
    import urllib.request

    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    body = json.dumps({"chat_id": chat_id, "text": message, "parse_mode": "HTML"}).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass


def _parse_devices(minutes: int) -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    user_devices: dict = defaultdict(dict)
    user_last_seen: dict = {}

    try:
        import json as _json

        with open(CADDY_LOG, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    e = _json.loads(line)
                except Exception:
                    continue

                try:
                    ts = datetime.fromtimestamp(float(e.get("ts", 0)), tz=timezone.utc)
                except Exception:
                    continue
                if ts < cutoff:
                    continue

                req = e.get("request", {})
                uri = req.get("uri", "")
                if "/vip/" not in uri:
                    continue

                status = e.get("status", 0)

                resp = e.get("resp_headers", {})
                cd = resp.get("Content-Disposition", [""])[0]
                username = ""
                if "filename=" in cd:
                    username = cd.split("filename=")[-1].strip('"').strip("'").strip()

                if not username:
                    try:
                        token = uri.split("/vip/")[1].split("?")[0]
                        padded = token + "=" * (4 - len(token) % 4)
                        decoded = base64.urlsafe_b64decode(padded).decode("utf-8", errors="ignore")
                        if "," in decoded:
                            username = decoded.split(",")[0].strip()
                        else:
                            username = f"[{token[:14]}]"
                    except Exception:
                        username = "[unknown]"

                headers = req.get("headers", {})
                hwid = (headers.get("X-Hwid", [""])[0] or headers.get("X-HWID", [""])[0]).strip()
                model = headers.get("X-Device-Model", [""])[0].strip()
                os_name = headers.get("X-Device-Os", [""])[0].strip()
                os_ver = headers.get("X-Ver-Os", [""])[0].strip()
                locale = headers.get("X-Device-Locale", [""])[0].strip()
                ua = headers.get("User-Agent", [""])[0].strip()
                ip = req.get("remote_ip", "?")
                app = ua.split("/")[0] if "/" in ua else ua[:20]

                device_key = f"hwid:{hwid}" if hwid else f"ip:{ip}"

                device_info = {
                    "hwid": hwid or None,
                    "ip": ip,
                    "model": model or None,
                    "os": f"{os_name} {os_ver}".strip() or None,
                    "app": app,
                    "locale": locale or None,
                    "status": status,
                    "last": ts.isoformat(),
                }

                existing = user_devices[username].get(device_key)
                if not existing or ts.isoformat() > existing["last"]:
                    user_devices[username][device_key] = device_info

                prev = user_last_seen.get(username)
                if not prev or ts.isoformat() > prev:
                    user_last_seen[username] = ts.isoformat()

    except FileNotFoundError:
        return {"error": f"Log file not found: {CADDY_LOG}"}

    users = []
    for username, devices in user_devices.items():
        count = len(devices)
        hwid_count = sum(1 for k in devices if k.startswith("hwid:"))
        flag = "suspicious" if count >= 5 else ("sharing" if count >= 3 else "ok")

        users.append({
            "username": username,
            "device_count": count,
            "hwid_count": hwid_count,
            "flag": flag,
            "last_seen": user_last_seen.get(username),
            "devices": list(devices.values()),
        })

    users.sort(key=lambda x: -x["device_count"])

    # Telegram alerts for newly suspicious users
    for u in users:
        if u["flag"] == "suspicious" and u["username"] not in _alerted_suspicious:
            _alerted_suspicious.add(u["username"])
            lines = [
                f"  • {d.get('model') or d.get('ip')} ({d.get('app')})"
                for d in u["devices"][:5]
            ]
            _send_telegram(
                f"🚨 <b>Suspicious user detected</b>\n"
                f"User: <code>{u['username']}</code>\n"
                f"Devices: {u['device_count']}  HWID: {u['hwid_count']}\n"
                + "\n".join(lines)
            )

    return {
        "minutes": minutes,
        "generated": datetime.now(timezone.utc).isoformat(),
        "total_users": len(users),
        "users": users,
    }


def _get_devices(minutes: int) -> dict:
    global _cache_result, _cache_minutes, _cache_ts
    now = time.monotonic()
    if _cache_result is not None and _cache_minutes == minutes and (now - _cache_ts) < _CACHE_TTL:
        return _cache_result
    result = _parse_devices(minutes)
    _cache_result = result
    _cache_minutes = minutes
    _cache_ts = now
    return result


@router.get("/devices")
def get_devices(
    minutes: int = Query(default=60, ge=1, le=10080),
    admin: Admin = Depends(Admin.get_current),
):
    """
    Returns active devices per subscription user parsed from Caddy access logs.
    Flags accounts with 3+ devices as 'sharing' and 5+ as 'suspicious'.
    Results are cached for 60 seconds.
    """
    return _get_devices(minutes)
