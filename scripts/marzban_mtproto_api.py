#!/usr/bin/env python3
import getpass
import sys
import urllib.parse

import requests


def main():
    marzban_url = "https://config.the-tech.studio"
    
    admin_username = 'Marz'
    admin_password = 'xH6gI2rL6ubW'
    target_user = '758881284'
    proxy_host = 'tg.the-tech.studio'
    token_response = requests.post(
        f"{marzban_url}/api/admin/token",
        data={
            "username": admin_username,
            "password": admin_password,
        },
        verify=False,
        timeout=30,
    )
    token_response.raise_for_status()
    token = token_response.json()["access_token"]

    mtproto_response = requests.get(
        f"{marzban_url}/api/user/{target_user}/mtproto",
        headers={"Authorization": f"Bearer {token}"},
        verify=False,
        timeout=30,
    )
    mtproto_response.raise_for_status()
    data = mtproto_response.json()

    port = data["port"]
    secret = data["secret"]

    tg_link = "tg://proxy?" + urllib.parse.urlencode(
        {
            "server": proxy_host,
            "port": str(port),
            "secret": secret,
        }
    )

    tme_link = "https://t.me/proxy?" + urllib.parse.urlencode(
        {
            "server": proxy_host,
            "port": str(port),
            "secret": secret,
        }
    )

    print("\nMTProto link:")
    print(tg_link)

    print("\nFallback HTTPS link:")
    print(tme_link)

    print("\nRaw API response:")
    print(data)


if __name__ == "__main__":
    try:
        main()
    except requests.HTTPError as exc:
        print(f"HTTP error: {exc}")
        if exc.response is not None:
            try:
                print(exc.response.json())
            except Exception:
                print(exc.response.text)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nCancelled")
        sys.exit(1)
    except Exception as exc:
        print(f"Error: {exc}")
        sys.exit(1)
