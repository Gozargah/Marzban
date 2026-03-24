#!/usr/bin/env bash
# Idempotent Hysteria2 setup script.
# Safe to re-run after every "marzban update" — it only generates tokens/config
# if they're missing; never overwrites values that already exist.
set -euo pipefail

ENV_FILE="/opt/marzban/.env"
HYSTERIA_YAML="/var/lib/marzban/hysteria.yaml"
CERTS_DIR="/var/lib/marzban/certs"

# ── helpers ──────────────────────────────────────────────────────────────────

log() { echo "[hysteria-setup] $*"; }

# Read a value from .env (last occurrence wins, strips spaces and quotes)
env_get() {
    grep "^${1}" "$ENV_FILE" 2>/dev/null | tail -1 \
        | cut -d'=' -f2- | tr -d ' "'
}

# Append key=value only if the key is absent
env_set_if_missing() {
    local key="$1" val="$2"
    if ! grep -q "^${key}" "$ENV_FILE" 2>/dev/null; then
        echo "${key}=${val}" >> "$ENV_FILE"
        log "Added ${key} to .env"
    fi
}

# ── 1. Ensure tokens exist in .env ───────────────────────────────────────────

env_set_if_missing "HYSTERIA2_HOOK_TOKEN"      "$(openssl rand -hex 32)"
env_set_if_missing "HYSTERIA2_TRAFFIC_SECRET"  "$(openssl rand -hex 32)"
env_set_if_missing "HYSTERIA2_TRAFFIC_LISTEN"  "127.0.0.1:9999"

# ── 2. Read current values ────────────────────────────────────────────────────

HOOK_TOKEN=$(env_get HYSTERIA2_HOOK_TOKEN)
TRAFFIC_SECRET=$(env_get HYSTERIA2_TRAFFIC_SECRET)
TRAFFIC_LISTEN=$(env_get HYSTERIA2_TRAFFIC_LISTEN)

# Marzban port & protocol
MARZBAN_PORT=$(env_get UVICORN_PORT); MARZBAN_PORT="${MARZBAN_PORT:-8000}"
SSL_CERT=$(env_get UVICORN_SSL_CERTFILE)
PROTO="http"
[[ -n "$SSL_CERT" ]] && PROTO="https"

# Domain: try to extract CN from the TLS cert, fall back to hostname
DOMAIN=""
if [[ -f "$CERTS_DIR/fullchain.pem" ]]; then
    DOMAIN=$(openssl x509 -noout -subject -in "$CERTS_DIR/fullchain.pem" 2>/dev/null \
        | grep -oP '(?<=CN\s=\s)[^,/]+' || true)
fi
[[ -z "$DOMAIN" ]] && DOMAIN=$(hostname -f)

# ── 3. Create hysteria.yaml (only if it doesn't exist) ───────────────────────
#    To force-recreate: rm /var/lib/marzban/hysteria.yaml and re-run.

if [[ -f "$HYSTERIA_YAML" ]]; then
    log "hysteria.yaml already exists — skipping creation (delete to regenerate)"
else
    log "Creating hysteria.yaml (domain: $DOMAIN, port: 443)"
    mkdir -p "$(dirname "$HYSTERIA_YAML")"
    cat > "$HYSTERIA_YAML" <<YAML
listen: :443

tls:
  cert: /certs/fullchain.pem
  key: /certs/key.pem

auth:
  type: http
  http:
    url: ${PROTO}://127.0.0.1:${MARZBAN_PORT}/api/hysteria/auth?token=${HOOK_TOKEN}
    insecure: true
    timeout: 10s

trafficStats:
  listen: ${TRAFFIC_LISTEN}
  secret: ${TRAFFIC_SECRET}

masquerade:
  type: proxy
  proxy:
    url: https://${DOMAIN}
    rewriteHost: true

bandwidth:
  up: 100 mbps
  down: 200 mbps

# QUIC tuning — optimised for Russian mobile networks (MTS, Beeline, Megafon, Tele2).
# keepAlivePeriod: 10s PING keeps CGNAT alive; resets idle timer for awake clients.
# maxIdleTimeout: 30s — only fires when client stops responding to PINGs (phone asleep).
#   Active clients are unaffected because keepAlive resets the idle timer every 10s.
#   Sleeping clients get cleaned up in 30s → faster STATELESS_RESET on wake → faster reconnect.
quic:
  initStreamReceiveWindow: 8388608
  maxStreamReceiveWindow: 8388608
  initConnReceiveWindow: 20971520
  maxConnReceiveWindow: 20971520
  maxIdleTimeout: 30s
  keepAlivePeriod: 10s
  disablePathMTUDiscovery: true

transport:
  udp:
    mtu: 1400
YAML
    log "hysteria.yaml created"
fi

log "Setup complete."
