"""Issuing and renewing TLS certificates through certbot.

The panel shells out to the certbot binary rather than talking ACME itself, so
certificates live where certbot puts them (/etc/letsencrypt) and the usual
`certbot renew` cron keeps working alongside the panel.

Everything here runs as a fixed argument list — never through a shell — and
every domain is validated before it reaches that list.
"""

import re
import subprocess
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional

from config import (CERTBOT_EMAIL, CERTBOT_ENABLED, CERTBOT_EXECUTABLE_PATH,
                    CERTBOT_STAGING, CERTBOT_TIMEOUT, CERTBOT_WEBROOT)

# A hostname label: 1-63 chars, no leading or trailing hyphen.
LABEL = r"(?!-)[A-Za-z0-9-]{1,63}(?<!-)"
DOMAIN_RE = re.compile(rf"^{LABEL}(\.{LABEL})+$")

# certbot certificates prints a block per lineage; these pull the fields out.
_NAME_RE = re.compile(r"^\s*Certificate Name:\s*(.+)$")
_DOMAINS_RE = re.compile(r"^\s*Domains:\s*(.+)$")
_EXPIRY_RE = re.compile(r"^\s*Expiry Date:\s*(\S+ \S+)")
_CERT_PATH_RE = re.compile(r"^\s*Certificate Path:\s*(.+)$")
_KEY_PATH_RE = re.compile(r"^\s*Private Key Path:\s*(.+)$")

VALIDATION_METHODS = ("standalone", "webroot")


class CertbotError(Exception):
    """certbot could not do what was asked; the message is safe to show."""


@dataclass
class Certificate:
    name: str
    domains: List[str]
    expires_at: Optional[datetime]
    certificate_path: Optional[str]
    private_key_path: Optional[str]

    @property
    def days_left(self) -> Optional[int]:
        if not self.expires_at:
            return None
        return (self.expires_at - datetime.now(self.expires_at.tzinfo)).days


def is_enabled() -> bool:
    return bool(CERTBOT_ENABLED)


def validate_domain(domain: str) -> str:
    """Normalise one domain, rejecting anything that is not a plain hostname."""
    domain = domain.strip().rstrip(".").lower()
    if not domain:
        raise CertbotError("A domain is required.")
    if domain.startswith("*."):
        raise CertbotError(
            "Wildcard certificates need a DNS-01 plugin, which the panel does not drive. "
            "Issue those with certbot on the server directly."
        )
    if len(domain) > 253 or not DOMAIN_RE.match(domain):
        raise CertbotError(f"{domain!r} is not a valid domain name.")
    return domain


def validate_domains(domains: List[str]) -> List[str]:
    validated = []
    for domain in domains:
        domain = validate_domain(domain)
        if domain not in validated:
            validated.append(domain)
    if not validated:
        raise CertbotError("At least one domain is required.")
    return validated


def _run(args: List[str]) -> str:
    """Run certbot and return its output, turning failures into CertbotError."""
    if not is_enabled():
        raise CertbotError(
            "Certificate management is disabled. Set CERTBOT_ENABLED=true and make sure "
            "certbot is installed on the host running the panel."
        )

    try:
        result = subprocess.run(
            [CERTBOT_EXECUTABLE_PATH, *args],
            capture_output=True,
            text=True,
            timeout=CERTBOT_TIMEOUT,
            check=False,
        )
    except FileNotFoundError:
        raise CertbotError(f"certbot was not found at {CERTBOT_EXECUTABLE_PATH}.")
    except subprocess.TimeoutExpired:
        raise CertbotError(f"certbot did not finish within {CERTBOT_TIMEOUT} seconds.")
    except PermissionError:
        raise CertbotError("The panel is not allowed to run certbot. It needs root privileges.")

    if result.returncode != 0:
        raise CertbotError(_last_meaningful_line(result.stderr or result.stdout))

    return result.stdout


def _last_meaningful_line(output: str) -> str:
    """certbot puts the actual reason on one of the last lines of its output."""
    lines = [line.strip() for line in (output or "").splitlines() if line.strip()]
    for line in reversed(lines):
        if not line.startswith("Saving debug log") and not line.startswith("-"):
            return line[:400]
    return "certbot failed without an error message."


def _parse_expiry(value: str) -> Optional[datetime]:
    # e.g. "2026-08-27 10:12:41+00:00 (VALID: 89 days)"
    try:
        return datetime.fromisoformat(value.strip())
    except ValueError:
        return None


def parse_certificates(output: str) -> List[Certificate]:
    """Turn `certbot certificates` output into structured records."""
    certificates: List[Certificate] = []
    current: Optional[dict] = None

    def flush():
        if current and current.get("name"):
            certificates.append(
                Certificate(
                    name=current["name"],
                    domains=current.get("domains", []),
                    expires_at=current.get("expires_at"),
                    certificate_path=current.get("certificate_path"),
                    private_key_path=current.get("private_key_path"),
                )
            )

    for line in (output or "").splitlines():
        name = _NAME_RE.match(line)
        if name:
            flush()
            current = {"name": name.group(1).strip()}
            continue
        if current is None:
            continue

        domains = _DOMAINS_RE.match(line)
        if domains:
            current["domains"] = domains.group(1).split()
            continue
        expiry = _EXPIRY_RE.match(line)
        if expiry:
            current["expires_at"] = _parse_expiry(expiry.group(1))
            continue
        cert_path = _CERT_PATH_RE.match(line)
        if cert_path:
            current["certificate_path"] = cert_path.group(1).strip()
            continue
        key_path = _KEY_PATH_RE.match(line)
        if key_path:
            current["private_key_path"] = key_path.group(1).strip()

    flush()
    return certificates


def build_issue_args(
    domains: List[str],
    email: Optional[str] = None,
    method: str = "standalone",
    webroot: Optional[str] = None,
) -> List[str]:
    """The argument list for a new certificate, validated end to end."""
    domains = validate_domains(domains)

    if method not in VALIDATION_METHODS:
        raise CertbotError(f"Unsupported validation method {method!r}.")

    email = (email or CERTBOT_EMAIL or "").strip()
    args = ["certonly", "--non-interactive", "--agree-tos", "--keep-until-expiring"]

    if email:
        if " " in email or "@" not in email:
            raise CertbotError(f"{email!r} is not a valid email address.")
        args += ["--email", email]
    else:
        args.append("--register-unsafely-without-email")

    if method == "standalone":
        args.append("--standalone")
    else:
        path = (webroot or CERTBOT_WEBROOT or "").strip()
        if not path.startswith("/"):
            raise CertbotError("Webroot validation needs an absolute path to the served directory.")
        args += ["--webroot", "--webroot-path", path]

    if CERTBOT_STAGING:
        args.append("--staging")

    for domain in domains:
        args += ["-d", domain]

    return args


def list_certificates() -> List[Certificate]:
    return parse_certificates(_run(["certificates"]))


def issue_certificate(
    domains: List[str],
    email: Optional[str] = None,
    method: str = "standalone",
    webroot: Optional[str] = None,
) -> List[Certificate]:
    _run(build_issue_args(domains, email=email, method=method, webroot=webroot))
    return list_certificates()


def renew_certificate(name: str, force: bool = False) -> List[Certificate]:
    """Renew one lineage, by default only when it is actually due.

    `--force-renewal` issues a fresh certificate whatever the expiry says, and
    Let's Encrypt counts five duplicates of the same set of names per week:
    a handful of renew clicks is enough to lock the domain out until the
    window slides. Certbot's own answer for a certificate that is not due is
    to do nothing and say so, which is what an admin pressing the button
    wants nearly every time. Forcing stays available, but has to be asked for.
    """
    args = ["renew", "--cert-name", _validate_name(name), "--non-interactive"]
    if force:
        args.append("--force-renewal")
    _run(args)
    return list_certificates()


def delete_certificate(name: str) -> List[Certificate]:
    _run(["delete", "--cert-name", _validate_name(name), "--non-interactive"])
    return list_certificates()


def _validate_name(name: str) -> str:
    """A lineage name, as certbot itself allows it: a hostname-ish token."""
    name = (name or "").strip()
    if not name or len(name) > 253 or not re.match(r"^[A-Za-z0-9._-]+$", name):
        raise CertbotError(f"{name!r} is not a valid certificate name.")
    return name
