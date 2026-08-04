import re

import requests

HAPP_CRYPTO_API_URL = "https://crypto.happ.su/api-v2.php"

_LINK_RE = re.compile(r"happ://crypt\d*/\S+")


class HappCryptError(Exception):
    pass


def encrypt_happ_link(url: str) -> str:
    """Turns a plain subscription URL into Happ's proprietary encrypted
    happ://cryptN/... link by calling Happ's own online encryption service.
    Happ encrypts with a per-version RSA key baked into the app, so this
    can't be done locally/offline - the real subscription URL is sent to
    Happ's server (crypto.happ.su) to obtain the encrypted result."""
    try:
        resp = requests.post(HAPP_CRYPTO_API_URL, json={"url": url}, timeout=10)
    except requests.RequestException as e:
        raise HappCryptError(f"Could not reach Happ's encryption service: {e}")

    if resp.status_code != 200:
        raise HappCryptError(f"Happ's encryption service returned HTTP {resp.status_code}")

    text = resp.text.strip()

    try:
        data = resp.json()
    except ValueError:
        data = None

    candidate = None
    if isinstance(data, str):
        candidate = data
    elif isinstance(data, dict):
        for key in ("url", "link", "result", "data", "encrypted", "crypt", "happ"):
            value = data.get(key)
            if isinstance(value, str) and value:
                candidate = value
                break
            if isinstance(value, dict):
                for nested_key in ("url", "link", "result", "encrypted", "crypt", "happ"):
                    nested_value = value.get(nested_key)
                    if isinstance(nested_value, str) and nested_value:
                        candidate = nested_value
                        break
            if candidate:
                break

    for source in (candidate, text):
        if not source:
            continue
        match = _LINK_RE.search(source)
        if match:
            return match.group(0)
        if source.startswith("happ://"):
            return source

    raise HappCryptError(f"Unexpected response from Happ's encryption service: {text[:300]}")
