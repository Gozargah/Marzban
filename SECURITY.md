# Security policy

Xenith guards access to a proxy server: it holds admin credentials, issues
subscription links, and on many installs runs as root so it can drive nginx,
certbot and sysctl. A flaw here is worth reporting carefully.

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's private vulnerability reporting:

1. Go to the [Security tab](https://github.com/bugbusta/Xenith/security).
2. Click **Report a vulnerability**.

That opens a private thread visible only to the maintainers. If you cannot use
it, open a normal issue saying only that you have a security report and asking
for a contact — no details in the public issue.

Expect a first reply within a week. If a fix is warranted, the report stays
private until a patched release is out, and you are credited in the advisory
unless you would rather not be.

## What is in scope

Anything that lets someone do what they should not be able to do on a panel
that is configured as this repository documents:

- reaching the API or dashboard without valid admin credentials, or as a
  different admin than the token belongs to
- reading or guessing another user's subscription link, or fetching a
  subscription without a valid token
- reading or writing files outside the directories the panel manages, through
  the nginx page uploads, certificate handling or template loading
- getting the panel to execute a command it was not meant to run
- privilege escalation between an ordinary admin and a sudo admin

## What is not

- Findings that need `DEBUG=true`, `DOCS=true`, or a `.env` that the
  documentation warns against. Those are documented trade-offs, not flaws.
- Anything reachable only by someone who already has a sudo admin token. A
  sudo admin can edit the Xray configuration and, where the feature is enabled,
  the host's nginx and kernel settings — that is what the role is for.
- Weaknesses in Xray-core itself. Report those to
  [XTLS/Xray-core](https://github.com/XTLS/Xray-core/security).
- Denial of service through sheer traffic volume.
- Missing hardening headers on a panel that is meant to sit behind a reverse
  proxy, unless you can show a concrete attack.

## Settings that decide how exposed an install is

Worth checking before reporting, and worth checking on your own server:

| Setting | Why it matters |
|---|---|
| `TRUSTED_PROXIES` | Empty means `X-Forwarded-For` is ignored and the peer address is used. Set it to your proxy only — a wildcard lets any client forge the address used for login rate limiting. |
| `ACCEPT_LEGACY_SUBSCRIPTION_TOKENS` | Keeps honouring pre-fork links, which carry a 60-bit truncated hash instead of an HMAC. A migration window, not a setting to leave on. |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `0` means admin tokens never expire; a leaked one is then valid until that admin's password changes. |
| `DEBUG`, `DOCS` | Both are off by default and both widen what is reachable. Neither belongs on a public install. |
| `SUDO_USERNAME` / `SUDO_PASSWORD` | Stored in the clear in `.env`. Prefer creating admins with `xenith cli admin create --sudo`, which stores a bcrypt hash. |

## Supported versions

Fixes go onto `main` and into the next release. Only the latest release is
supported; there are no backport branches. The `0.8.x` tags in this repository
predate the fork and are Marzban's — they get nothing from here.
