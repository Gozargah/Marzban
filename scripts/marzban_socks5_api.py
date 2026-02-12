#!/usr/bin/env python3
"""
Независимый скрипт: подключается к API Marzban, получает токен и возвращает
данные SOCKS5 по всем пользователям (host, port, username, password).

Использование:
  python marzban_socks5_api.py
  python marzban_socks5_api.py --base-url https://panel.example.com --user admin --password secret
  python marzban_socks5_api.py -o json
"""

import argparse
import json
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request


def request(
    url: str,
    method: str = "GET",
    data: dict | None = None,
    token: str | None = None,
    verify_ssl: bool = True,
) -> tuple[dict | list, int]:
    """Выполняет HTTP-запрос, возвращает (parsed_json, status_code)."""
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = None
    if data is not None:
        if "Content-Type" not in headers:
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        body = urllib.parse.urlencode(data).encode("utf-8")

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    ctx = ssl.create_default_context()
    if not verify_ssl:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            raw = resp.read().decode("utf-8")
            status = resp.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8") if e.fp else "{}"
        status = e.code
    except Exception as e:
        return {"error": str(e)}, 0

    try:
        parsed = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        parsed = {"raw": raw}

    return parsed, status


def get_token(base_url: str, username: str, password: str, verify_ssl: bool = True) -> str | None:
    """Получает JWT токен через POST /api/admin/token."""
    url = urllib.parse.urljoin(base_url.rstrip("/") + "/", "api/admin/token")
    data = {"username": username, "password": password}
    out, status = request(url, method="POST", data=data, verify_ssl=verify_ssl)
    if status != 200:
        return None
    return out.get("access_token")


def get_users(base_url: str, token: str, verify_ssl: bool = True) -> list[dict]:
    """Список пользователей GET /api/users."""
    url = urllib.parse.urljoin(base_url.rstrip("/") + "/", "api/users")
    out, status = request(url, token=token, verify_ssl=verify_ssl)
    if status != 200 or "users" not in out:
        return []
    return out.get("users", [])


def get_user_socks5(base_url: str, token: str, username: str, verify_ssl: bool = True) -> dict | None:
    """SOCKS5 для одного пользователя GET /api/user/{username}/socks5."""
    path = f"api/user/{urllib.parse.quote(username, safe='')}/socks5"
    url = urllib.parse.urljoin(base_url.rstrip("/") + "/", path)
    out, status = request(url, token=token, verify_ssl=verify_ssl)
    if status != 200:
        return None
    return out


def main():
    parser = argparse.ArgumentParser(description="Получить SOCKS5 данные из Marzban API")
    parser.add_argument(
        "--base-url",
        "-b",
        default="https://testvpn.the-tech.studio:8443",
        help="Базовый URL панели Marzban",
    )
    parser.add_argument("--user", "-u", default="Marz", help="Логин админа")
    parser.add_argument("--password", "-p", default="123456", help="Пароль админа")
    parser.add_argument(
        "--no-verify-ssl",
        action="store_true",
        help="Отключить проверку SSL (самоподписанные сертификаты)",
    )
    parser.add_argument(
        "--output",
        "-o",
        choices=("text", "json"),
        default="text",
        help="Формат вывода: text или json",
    )
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    verify = not args.no_verify_ssl

    token = get_token(base, args.user, args.password, verify_ssl=verify)
    if not token:
        print("Ошибка: не удалось получить токен (неверный логин/пароль или недоступен API).", file=sys.stderr)
        sys.exit(1)

    users = get_users(base, token, verify_ssl=verify)
    if not users:
        print("Пользователи не найдены или нет доступа.", file=sys.stderr)
        if args.output == "json":
            print(json.dumps({"socks5": [], "users_count": 0}, ensure_ascii=False, indent=2))
        sys.exit(0)

    socks5_list = []
    for u in users:
        username = u.get("username")
        if not username:
            continue
        s5 = get_user_socks5(base, token, username, verify_ssl=verify)
        if s5 and "error" not in s5:
            s5["marzban_username"] = username
            socks5_list.append(s5)

    if args.output == "json":
        print(json.dumps({"socks5": socks5_list, "users_count": len(socks5_list)}, ensure_ascii=False, indent=2))
        return

    # Текстовый вывод
    for s5 in socks5_list:
        print(f"User: {s5.get('marzban_username', '')}")
        print(f"  Host:     {s5.get('host', '')}")
        print(f"  Port:     {s5.get('port', '')}")
        print(f"  Username: {s5.get('username', '')}")
        print(f"  Password: {s5.get('password', '')}")
        print(f"  URI:      socks5://{s5.get('username', '')}:{s5.get('password', '')}@{s5.get('host', '')}:{s5.get('port', '')}")
        print()


if __name__ == "__main__":
    main()
