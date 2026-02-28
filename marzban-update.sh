#!/usr/bin/env bash
# Drop-in replacement for "marzban update".
# Usage: bash /opt/marzban/marzban-update.sh
set -euo pipefail

COMPOSE_FILE="/opt/marzban/docker-compose.yml"

# ── 1. Run Hysteria2 setup (idempotent) ──────────────────────────────────────
bash "$(dirname "$0")/setup-hysteria.sh"

# ── 2. Update Marzban via the official script ────────────────────────────────
marzban update

# ── 3. Start ALL services (marzban update only starts the marzban service) ───
echo "[marzban-update] Starting all services..."
cd /opt/marzban && docker compose -f "$COMPOSE_FILE" up -d

echo "[marzban-update] Done. All services:"
docker compose -f "$COMPOSE_FILE" ps
