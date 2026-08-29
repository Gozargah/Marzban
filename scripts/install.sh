#!/usr/bin/env bash
#
# Xenith installer for a fresh Debian/Ubuntu server.
#
# Installs Docker, builds (or pulls) the panel image, writes /opt/xenith/.env
# with a generated sudo password, optionally obtains a Let's Encrypt certificate
# so the panel is served over HTTPS, and starts everything under Docker.
#
#   curl -fsSL https://raw.githubusercontent.com/bugbusta/Xenith/main/scripts/install.sh | bash -s -- --domain panel.example.com --email ops@example.com
#
# Run it again to upgrade: it keeps the existing .env and data.

set -euo pipefail

INSTALL_DIR=/opt/xenith
DATA_DIR=/var/lib/marzban
LETSENCRYPT_DIR=/etc/letsencrypt
REPO_URL=https://github.com/bugbusta/Xenith.git
REPO_REF=main
IMAGE=xenith:local
IMAGE_SOURCE=build          # build | pull
PULL_IMAGE=ghcr.io/bugbusta/xenith:latest
DOMAIN=""
EMAIL=""
PANEL_PORT=8000
WITH_TLS=1
WITH_NGINX=0
ASSUME_YES=0

log()   { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m warn\033[0m %s\n' "$*" >&2; }
die()   { printf '\033[1;31m error\033[0m %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<USAGE
Xenith installer

Usage: install.sh [options]

  --domain <host>     Domain that points at this server. Enables HTTPS and
                      subscription links. Without it the panel binds to
                      localhost only and you reach it through an SSH tunnel.
  --email <address>   Contact address for Let's Encrypt expiry notices.
  --port <port>       Port the panel listens on (default: ${PANEL_PORT}).
  --pull              Use the published image (${PULL_IMAGE}) instead of
                      building from this repository.
  --ref <git-ref>     Branch or tag to build from (default: ${REPO_REF}).
  --no-tls            Skip certificate issuance even when --domain is given.
  --with-nginx        Let the panel manage the host's nginx. Mounts /etc/nginx
                      and shares the host's PID namespace, which the container
                      needs to signal nginx but which also removes process
                      isolation between the two.
  --yes               Do not ask for confirmation.
  --help              Show this message.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --email)  EMAIL="${2:-}"; shift 2 ;;
    --port)   PANEL_PORT="${2:-}"; shift 2 ;;
    --pull)   IMAGE_SOURCE=pull; IMAGE="$PULL_IMAGE"; shift ;;
    --ref)    REPO_REF="${2:-}"; shift 2 ;;
    --no-tls) WITH_TLS=0; shift ;;
    --with-nginx) WITH_NGINX=1; shift ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) die "Unknown option: $1 (try --help)" ;;
  esac
done

# ── preflight ────────────────────────────────────────────────────────────────

[[ $EUID -eq 0 ]] || die "Run this as root (sudo bash install.sh ...)."
[[ -f /etc/debian_version ]] || warn "This installer targets Debian/Ubuntu. Continuing anyway."

if [[ -n "$DOMAIN" && ! "$DOMAIN" =~ ^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$ ]]; then
  die "--domain must be a plain hostname, e.g. panel.example.com"
fi
if [[ ! "$PANEL_PORT" =~ ^[0-9]+$ ]] || (( PANEL_PORT < 1 || PANEL_PORT > 65535 )); then
  die "--port must be a number between 1 and 65535"
fi

log "Installing Xenith"
echo "    directory : $INSTALL_DIR"
echo "    data      : $DATA_DIR"
echo "    image     : $IMAGE ($IMAGE_SOURCE)"
echo "    domain    : ${DOMAIN:-<none, localhost only>}"
echo "    port      : $PANEL_PORT"

if (( ! ASSUME_YES )); then
  read -rp "Continue? [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]] || die "Aborted."
fi

# ── dependencies ─────────────────────────────────────────────────────────────

log "Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git openssl >/dev/null

if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker"
  curl -fsSL https://get.docker.com | sh
else
  log "Docker is already installed"
fi

docker compose version >/dev/null 2>&1 || die "The Docker Compose plugin is missing. Install docker-compose-plugin and re-run."

systemctl enable --now docker >/dev/null 2>&1 || true

mkdir -p "$INSTALL_DIR" "$DATA_DIR" "$LETSENCRYPT_DIR"

# ── image ────────────────────────────────────────────────────────────────────

if [[ "$IMAGE_SOURCE" == "build" ]]; then
  if [[ -d "$INSTALL_DIR/src/.git" ]]; then
    log "Updating sources ($REPO_REF)"
    git -C "$INSTALL_DIR/src" fetch --depth 1 origin "$REPO_REF"
    git -C "$INSTALL_DIR/src" checkout -q FETCH_HEAD
  else
    log "Cloning sources ($REPO_REF)"
    rm -rf "$INSTALL_DIR/src"
    git clone --depth 1 --branch "$REPO_REF" "$REPO_URL" "$INSTALL_DIR/src"
  fi

  log "Building the image (this takes a few minutes)"
  docker build -t "$IMAGE" "$INSTALL_DIR/src"
else
  log "Pulling $IMAGE"
  docker pull "$IMAGE"
fi

# ── certificate ──────────────────────────────────────────────────────────────

CERT_DIR="$LETSENCRYPT_DIR/live/$DOMAIN"
HAVE_CERT=0

if [[ -n "$DOMAIN" && $WITH_TLS -eq 1 ]]; then
  if [[ -f "$CERT_DIR/fullchain.pem" ]]; then
    log "Reusing the existing certificate for $DOMAIN"
    HAVE_CERT=1
  else
    log "Obtaining a certificate for $DOMAIN"

    if ss -lnt 2>/dev/null | awk '{print $4}' | grep -qE '(^|[:.])80$'; then
      warn "Something is already listening on port 80; certbot needs it free."
      warn "Stop it and re-run, or issue the certificate yourself and set UVICORN_SSL_* in $INSTALL_DIR/.env."
    fi

    certbot_args=(certonly --standalone --non-interactive --agree-tos --keep-until-expiring -d "$DOMAIN")
    if [[ -n "$EMAIL" ]]; then
      certbot_args+=(--email "$EMAIL")
    else
      certbot_args+=(--register-unsafely-without-email)
    fi

    # certbot ships inside the panel image, so the host stays clean.
    if docker run --rm -p 80:80 -v "$LETSENCRYPT_DIR:/etc/letsencrypt" --entrypoint certbot "$IMAGE" "${certbot_args[@]}"; then
      HAVE_CERT=1
    else
      warn "Certificate issuance failed. Installing without HTTPS; fix DNS and re-run, or use the Certificates screen later."
    fi
  fi
fi

# ── configuration ────────────────────────────────────────────────────────────

ENV_FILE="$INSTALL_DIR/.env"
SUDO_PASSWORD=""

if [[ -f "$ENV_FILE" ]]; then
  log "Keeping the existing $ENV_FILE"
else
  log "Writing $ENV_FILE"
  SUDO_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
  SUBSCRIPTION_PATH="$(openssl rand -hex 6)"

  {
    echo "# Generated by scripts/install.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "SUDO_USERNAME = \"admin\""
    echo "SUDO_PASSWORD = \"$SUDO_PASSWORD\""
    echo
    echo "UVICORN_HOST = \"0.0.0.0\""
    echo "UVICORN_PORT = $PANEL_PORT"
    if (( HAVE_CERT )); then
      echo "UVICORN_SSL_CERTFILE = \"$CERT_DIR/fullchain.pem\""
      echo "UVICORN_SSL_KEYFILE = \"$CERT_DIR/privkey.pem\""
    fi
    echo
    echo "# Subscription links live under this path; the random value keeps them"
    echo "# from being guessed."
    echo "XRAY_SUBSCRIPTION_PATH = \"$SUBSCRIPTION_PATH\""
    if [[ -n "$DOMAIN" ]]; then
      if (( PANEL_PORT == 443 )); then
        echo "XRAY_SUBSCRIPTION_URL_PREFIX = \"https://$DOMAIN\""
      else
        echo "XRAY_SUBSCRIPTION_URL_PREFIX = \"https://$DOMAIN:$PANEL_PORT\""
      fi
    fi
    echo
    echo "# TLS certificates from the Certificates screen."
    echo "CERTBOT_ENABLED = True"
    [[ -n "$EMAIL" ]] && echo "CERTBOT_EMAIL = \"$EMAIL\""
    echo
    echo "# Set this to your reverse proxy's address if you put one in front of"
    echo "# the panel; otherwise forwarding headers are ignored, which is what"
    echo "# you want when clients reach the panel directly."
    echo "# TRUSTED_PROXIES = '127.0.0.1,::1'"
    echo
    echo "# Login brute-force protection."
    echo "LOGIN_RATE_LIMIT_ATTEMPTS = 5"
    echo "LOGIN_RATE_LIMIT_WINDOW = 300"
  } > "$ENV_FILE"

  chmod 600 "$ENV_FILE"
fi

log "Writing $INSTALL_DIR/docker-compose.yml"
if (( WITH_NGINX )); then
  # Sharing the host's PID namespace is what lets the panel signal the host's
  # nginx master; without it a reload from the panel reaches nothing.
  NGINX_COMPOSE="    pid: host"
  NGINX_VOLUMES="      - /etc/nginx:/etc/nginx
      - /var/www:/var/www
      - /var/log/nginx:/var/log/nginx
      - /run:/run"
else
  NGINX_COMPOSE=""
  NGINX_VOLUMES=""
fi

cat > "$INSTALL_DIR/docker-compose.yml" <<COMPOSE
services:
  xenith:
    image: $IMAGE
    restart: always
    env_file: .env
    network_mode: host
$NGINX_COMPOSE
    # A proxy holds two descriptors per connection; the Docker default of 1024
    # runs out long before anything else does.
    ulimits:
      nofile:
        soft: 1048576
        hard: 1048576
    volumes:
      - $DATA_DIR:/var/lib/marzban
      - $LETSENCRYPT_DIR:/etc/letsencrypt
$NGINX_VOLUMES
COMPOSE

# Strip the blank lines the empty substitutions leave behind.
sed -i '/^[[:space:]]*$/d' "$INSTALL_DIR/docker-compose.yml"

# Only once: re-running the installer keeps an existing .env, and appending
# again would leave the file with a growing stack of the same setting.
if (( WITH_NGINX )) && ! grep -qE '^[[:space:]]*NGINX_ENABLED' "$ENV_FILE"; then
  echo "NGINX_ENABLED = True" >> "$ENV_FILE"
fi

# ── host command ─────────────────────────────────────────────────────────────

log "Installing the xenith command"
if [[ -f "$INSTALL_DIR/src/scripts/xenith" ]]; then
  install -m 755 "$INSTALL_DIR/src/scripts/xenith" /usr/local/bin/xenith
else
  curl -fsSL "https://raw.githubusercontent.com/bugbusta/Xenith/$REPO_REF/scripts/xenith" -o /usr/local/bin/xenith
  chmod 755 /usr/local/bin/xenith
fi

# ── start ────────────────────────────────────────────────────────────────────

log "Starting the panel"
cd "$INSTALL_DIR"
docker compose up -d

scheme="http"
(( HAVE_CERT )) && scheme="https"
host="${DOMAIN:-localhost}"
(( HAVE_CERT )) || host="localhost"

log "Waiting for the panel to answer"
ready=0
for _ in $(seq 1 30); do
  if curl -fsk --max-time 2 "$scheme://127.0.0.1:$PANEL_PORT/dashboard/" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done

echo
if (( ready )); then
  log "Xenith is running"
else
  warn "The panel did not answer yet. Check: xenith logs -f"
fi

if { (( PANEL_PORT == 443 )) && [[ "$scheme" == "https" ]]; } || { (( PANEL_PORT == 80 )) && [[ "$scheme" == "http" ]]; }; then
  echo "    dashboard : $scheme://$host/dashboard/"
else
  echo "    dashboard : $scheme://$host:$PANEL_PORT/dashboard/"
fi
if [[ -n "$SUDO_PASSWORD" ]]; then
  echo "    username  : admin"
  echo "    password  : $SUDO_PASSWORD"
  echo
  echo "    Credentials are stored in $ENV_FILE — save them now."
else
  echo "    username  : see SUDO_USERNAME in $ENV_FILE"
fi

if ! (( HAVE_CERT )); then
  echo
  warn "No certificate configured, so the panel only listens on localhost."
  warn "Reach it with:  ssh -L $PANEL_PORT:localhost:$PANEL_PORT root@<this-server>"
  warn "Then re-run with --domain, or issue a certificate from the Certificates screen."
fi

echo
echo "    logs      : xenith logs -f"
echo "    restart   : xenith restart"
echo "    cli       : xenith cli admin create --sudo"
echo "    update    : xenith update"
