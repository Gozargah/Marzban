#!/bin/bash
# One-shot installer for Marzban (Arsi build): asks a couple of questions
# up front, then installs docker/nginx if needed, builds the panel with
# docker compose, wires up an nginx reverse proxy on the chosen port, and
# creates a sudo admin -- no manual steps after this script finishes.
#
# Usage: sudo bash install.sh
#
# This script only manages its own nginx site file ("marzban") and only
# touches firewall rules if ufw is already active on this host; it never
# disables/removes an existing website or nginx site you already have.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_SITE="/etc/nginx/sites-available/marzban"
NGINX_LINK="/etc/nginx/sites-enabled/marzban"

if [ "$(id -u)" -ne 0 ]; then
  echo "This script needs root privileges. Re-run with: sudo bash install.sh" >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This installer only supports Debian/Ubuntu (apt-get not found)." >&2
  exit 1
fi

echo "=== Marzban installer ==="
echo

read -r -p "Panel port [8000]: " PANEL_PORT
PANEL_PORT=${PANEL_PORT:-8000}
if ! [[ "$PANEL_PORT" =~ ^[0-9]+$ ]] || [ "$PANEL_PORT" -lt 1 ] || [ "$PANEL_PORT" -gt 65535 ]; then
  echo "Invalid port '$PANEL_PORT', falling back to 8000." >&2
  PANEL_PORT=8000
fi

read -r -p "Admin username [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

read -r -s -p "Admin password (leave empty to auto-generate): " ADMIN_PASS
echo
if [ -z "$ADMIN_PASS" ]; then
  ADMIN_PASS=$(openssl rand -hex 12)
  GENERATED_PASS=true
else
  GENERATED_PASS=false
fi

INTERNAL_PORT=$((PANEL_PORT + 1))
if [ "$INTERNAL_PORT" = "$PANEL_PORT" ]; then
  INTERNAL_PORT=$((PANEL_PORT + 2))
fi

echo
echo "Installing Marzban:"
echo "  - Panel reachable on port: $PANEL_PORT"
echo "  - Admin username: $ADMIN_USER"
echo "  - Project directory: $PROJECT_DIR"
echo

# --- dependencies -----------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  echo "Installing docker..."
  curl -fsSL https://get.docker.com | sh
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "Installing nginx..."
  apt-get update -qq
  apt-get install -y -qq nginx
fi

# --- .env ---------------------------------------------------------------
cd "$PROJECT_DIR"
[ -f .env ] || cp .env.example .env

set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}[[:space:]]*=" .env; then
    sed -i "s|^${key}[[:space:]]*=.*|${key} = \"${value}\"|" .env
  elif grep -q "^# ${key}[[:space:]]*=" .env; then
    sed -i "s|^# ${key}[[:space:]]*=.*|${key} = \"${value}\"|" .env
  else
    echo "${key} = \"${value}\"" >> .env
  fi
}

set_env SQLALCHEMY_DATABASE_URL "sqlite:////var/lib/marzban/db.sqlite3"
set_env UVICORN_PORT "$INTERNAL_PORT"
set_env SUDO_USERNAME "$ADMIN_USER"
set_env SUDO_PASSWORD "$ADMIN_PASS"

mkdir -p /var/lib/marzban

# --- nginx ----------------------------------------------------------------
cat > "$NGINX_SITE" <<EOF
server {
    listen $PANEL_PORT;
    server_name _;

    gzip on;
    gzip_types text/css application/javascript application/json;
    gzip_min_length 1024;

    location / {
        proxy_pass http://127.0.0.1:$INTERNAL_PORT;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF
ln -sf "$NGINX_SITE" "$NGINX_LINK"
nginx -t
systemctl reload nginx || systemctl restart nginx

# --- firewall (only touch it if ufw is already active, never enable it) ---
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow "${PANEL_PORT}/tcp" >/dev/null
  ufw allow 1080/tcp >/dev/null
  ufw allow 1080/udp >/dev/null
  echo "ufw: opened ${PANEL_PORT}/tcp and 1080/tcp+udp"
else
  echo "ufw is inactive or not installed, skipping firewall changes."
fi

# --- build & start ----------------------------------------------------
echo
echo "Building and starting the panel (this can take a few minutes)..."
docker compose down >/dev/null 2>&1 || true
docker compose up -d --build

echo
echo "Waiting for the panel to come up..."
READY=false
for i in $(seq 1 30); do
  if docker compose logs marzban 2>/dev/null | grep -q "Application startup complete"; then
    READY=true
    break
  fi
  sleep 2
done

echo
if [ "$READY" = true ]; then
  echo "=== Done ==="
else
  echo "=== Container is still starting; check 'docker compose logs -f marzban' if the dashboard doesn't load in a minute ==="
fi

SERVER_IP=$(curl -fsS -4 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo "Dashboard: http://${SERVER_IP}:${PANEL_PORT}/dashboard/"
echo "Username:  $ADMIN_USER"
if [ "$GENERATED_PASS" = true ]; then
  echo "Password:  $ADMIN_PASS   (auto-generated, save it now)"
else
  echo "Password:  (the one you entered)"
fi
echo
echo "To fully remove everything later: sudo bash uninstall.sh"
