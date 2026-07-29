#!/bin/bash
# Fully removes a Marzban installation done via install_service.sh (systemd)
# and/or docker-compose.yml (docker): service, containers/volumes, data dir,
# xray-core binary, and the marzban-cli symlink.
#
# This project directory (the cloned/checked-out source code) is NOT removed.
#
# Usage: sudo bash uninstall.sh [-y|--yes]

set -u

SERVICE_NAME="marzban"
DATA_DIR="/var/lib/marzban"
XRAY_BIN="/usr/local/bin/xray"
XRAY_ASSETS_DIR="/usr/local/share/xray"
CLI_SYMLINK="/usr/bin/marzban-cli"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

FORCE=false
for arg in "$@"; do
  case "$arg" in
    -y|--yes) FORCE=true ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo "This script needs root privileges (systemd/docker/system paths). Re-run with sudo." >&2
  exit 1
fi

echo "This will remove:"
echo "  - the '$SERVICE_NAME' systemd service (if installed)"
echo "  - docker containers/volumes for this project (if docker-compose was used)"
echo "  - $DATA_DIR"
echo "  - $PROJECT_DIR/.env and $PROJECT_DIR/db.sqlite3"
echo "  - $XRAY_BIN and $XRAY_ASSETS_DIR"
echo "  - the $CLI_SYMLINK symlink"
echo
echo "The project source at $PROJECT_DIR itself will NOT be deleted."
echo

if [ "$FORCE" = false ]; then
  read -r -p "Continue? [y/N] " confirm
  case "$confirm" in
    [yY][eE][sS]|[yY]) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files "${SERVICE_NAME}.service" 2>/dev/null | grep -q "${SERVICE_NAME}.service"; then
  echo "Stopping and removing systemd service..."
  systemctl stop "$SERVICE_NAME" 2>/dev/null
  systemctl disable "$SERVICE_NAME" 2>/dev/null
  rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
  systemctl daemon-reload
fi

if [ -f "$PROJECT_DIR/docker-compose.yml" ] && command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    echo "Stopping and removing docker containers/volumes..."
    (cd "$PROJECT_DIR" && docker compose down --volumes --rmi local) 2>/dev/null
  fi
fi

if [ -d "$DATA_DIR" ]; then
  echo "Removing $DATA_DIR..."
  rm -rf "$DATA_DIR"
fi

rm -f "$PROJECT_DIR/.env" "$PROJECT_DIR/db.sqlite3"

if [ -f "$XRAY_BIN" ]; then
  echo "Removing xray-core binary..."
  rm -f "$XRAY_BIN"
fi
if [ -d "$XRAY_ASSETS_DIR" ]; then
  rm -rf "$XRAY_ASSETS_DIR"
fi

if [ -L "$CLI_SYMLINK" ] || [ -f "$CLI_SYMLINK" ]; then
  echo "Removing marzban-cli symlink..."
  rm -f "$CLI_SYMLINK"
fi
rm -f /etc/bash_completion.d/marzban-cli.sh 2>/dev/null

echo
echo "Marzban has been fully uninstalled. The project source at $PROJECT_DIR was left intact."
echo "Delete that directory yourself (rm -rf \"$PROJECT_DIR\") if you don't need the source anymore."
