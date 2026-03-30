#!/usr/bin/env python3
"""
Получает JWT и список узлов Marzban (GET /api/nodes) для проверки порядка.

Переменные окружения (если не заданы флаги):
  MARZBAN_BASE_URL   — например https://panel.example.com (без /dashboard/)
  MARZBAN_USERNAME
  MARZBAN_PASSWORD

Использование:
  python fetch_nodes.py
  python fetch_nodes.py --base-url https://panel.example.com -u admin -p secret
  python fetch_nodes.py --no-verify-ssl
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request


def request_json(
    url: str,
    method: str = "GET",
    form_data: dict | None = None,
    json_body: dict | None = None,
    token: str | None = None,
    verify_ssl: bool = True,
) -> tuple[dict | list, int]:
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = None
    if form_data is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        body = urllib.parse.urlencode(form_data).encode("utf-8")
    elif json_body is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(json_body).encode("utf-8")

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    ctx = ssl.create_default_context()
    if not verify_ssl:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            raw = resp.read().decode("utf-8")
            return (json.loads(raw) if raw.strip() else {}, resp.status)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw) if raw.strip() else {"detail": raw}
        except json.JSONDecodeError:
            parsed = {"detail": raw, "status": e.code}
        raise RuntimeError(f"HTTP {e.code}: {parsed}") from e


def fetch_token(base: str, username: str, password: str, verify_ssl: bool) -> str:
    url = base.rstrip("/") + "/api/admin/token"
    data, _ = request_json(
        url,
        method="POST",
        form_data={
            "username": username,
            "password": password,
            "grant_type": "password",
        },
        verify_ssl=verify_ssl,
    )
    if not isinstance(data, dict) or "access_token" not in data:
        raise RuntimeError(f"Unexpected token response: {data!r}")
    return str(data["access_token"])


def fetch_nodes(base: str, token: str, verify_ssl: bool) -> list:
    url = base.rstrip("/") + "/api/nodes"
    data, _ = request_json(url, token=token, verify_ssl=verify_ssl)
    if not isinstance(data, list):
        raise RuntimeError(f"Expected list, got: {type(data)}")
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description="List Marzban nodes via API")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("MARZBAN_BASE_URL", ""),
        help="Panel base URL (env MARZBAN_BASE_URL)",
    )
    parser.add_argument(
        "-u", "--user", default=os.environ.get("MARZBAN_USERNAME", ""), help="Admin username"
    )
    parser.add_argument(
        "-p",
        "--password",
        default=os.environ.get("MARZBAN_PASSWORD", ""),
        help="Admin password",
    )
    parser.add_argument(
        "--no-verify-ssl",
        action="store_true",
        help="Disable TLS certificate verification",
    )
    parser.add_argument(
        "--table",
        action="store_true",
        help="Print id, sort_order, name per line instead of full JSON",
    )
    args = parser.parse_args()

    base = args.base_url.strip()
    if not base:
        print("Set MARZBAN_BASE_URL or pass --base-url", file=sys.stderr)
        return 2
    if not args.user or not args.password:
        print("Set MARZBAN_USERNAME / MARZBAN_PASSWORD or use -u / -p", file=sys.stderr)
        return 2

    verify = not args.no_verify_ssl
    try:
        token = fetch_token(base, args.user, args.password, verify)
        nodes = fetch_nodes(base, token, verify)
    except Exception as e:
        print(e, file=sys.stderr)
        return 1

    if args.table:
        for n in nodes:
            if not isinstance(n, dict):
                continue
            sid = n.get("id", "")
            so = n.get("sort_order", "")
            name = n.get("name", "")
            print(f"{sid}\t{so}\t{name}")
    else:
        print(json.dumps(nodes, indent=2, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
