#!/bin/bash
# Marzban relay setup: turns THIS server into a transparent relay in front
# of your real Marzban/Xray backend servers (e.g. Sweden/Norway/Netherlands),
# for cases where this server's IP is reachable in your target country but
# a backend server's IP has been blocked.
#
# Two relay modes are supported, since they need different techniques:
#
#   TCP  (VLESS/VMess/Trojan/Shadowsocks over TCP, WS, gRPC, Reality, ...)
#        -> relayed via HAProxy in TCP mode with PROXY protocol v2, which
#           tells the backend the real client IP (needed for Marzban's
#           per-device IP limit to keep working correctly).
#
#   UDP  (Hysteria2, TUIC, VMess+QUIC, ...)
#        -> relayed via iptables DNAT+MASQUERADE. This mode does NOT
#           preserve the real client IP on the backend (the backend will
#           see every relayed client as this relay server's IP), because
#           there is no widely-supported PROXY-protocol equivalent for
#           arbitrary UDP. Accept this tradeoff or keep those backends on
#           a directly-reachable IP.
#
# For a TCP relay to actually forward the real client IP, the backend's
# Xray inbound that receives the relayed traffic must have
# "sockopt": {"acceptProxyProtocol": true} set -- see the printed
# instructions at the end of this script for exactly what to add and
# where (Marzban dashboard -> Core Settings), and how to point a Host
# entry at this relay so users in the blocked region use it.
#
# Usage: sudo bash relay_setup.sh

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "This script needs root privileges. Re-run with: sudo bash relay_setup.sh" >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This script only supports Debian/Ubuntu (apt-get not found)." >&2
  exit 1
fi

CONF_DIR="/etc/marzban-relay"
TCP_RULES="$CONF_DIR/tcp_rules.conf"
UDP_RULES="$CONF_DIR/udp_rules.conf"
HAPROXY_CFG="/etc/haproxy/haproxy.cfg"

mkdir -p "$CONF_DIR"
touch "$TCP_RULES" "$UDP_RULES"

# --- helpers ------------------------------------------------------------

ensure_haproxy() {
  if ! command -v haproxy >/dev/null 2>&1; then
    echo "Installing haproxy..."
    apt-get update -qq
    apt-get install -y -qq haproxy
  fi
}

ensure_iptables_persistent() {
  if ! dpkg -l 2>/dev/null | grep -q iptables-persistent; then
    echo "Installing iptables-persistent..."
    DEBIAN_FRONTEND=noninteractive apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq iptables-persistent netfilter-persistent
  fi
}

open_firewall_port() {
  local port="$1" proto="$2"
  if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
    ufw allow "${port}/${proto}" >/dev/null
  fi
}

valid_port() {
  [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -ge 1 ] && [ "$1" -le 65535 ]
}

add_tcp_rule() {
  echo
  echo "-- New TCP relay (HAProxy + PROXY protocol v2) --"
  read -r -p "Label (e.g. sweden): " LABEL
  read -r -p "Port to listen on THIS relay server (e.g. 8443): " LPORT
  if ! valid_port "$LPORT"; then echo "Invalid port, aborting." >&2; return; fi
  read -r -p "Backend server IP (e.g. Sweden VPS IP): " BIP
  read -r -p "Backend server port (e.g. 443): " BPORT
  if ! valid_port "$BPORT"; then echo "Invalid port, aborting." >&2; return; fi

  grep -v "^${LABEL}|" "$TCP_RULES" > "$TCP_RULES.tmp" 2>/dev/null || true
  mv "$TCP_RULES.tmp" "$TCP_RULES"
  echo "${LABEL}|${LPORT}|${BIP}|${BPORT}" >> "$TCP_RULES"
  echo "Saved. Run 'Apply / reload' from the menu to activate it."
}

add_udp_rule() {
  echo
  echo "-- New UDP/QUIC relay (iptables DNAT, real client IP NOT preserved) --"
  read -r -p "Label (e.g. sweden-quic): " LABEL
  read -r -p "Port to listen on THIS relay server (e.g. 36712): " LPORT
  if ! valid_port "$LPORT"; then echo "Invalid port, aborting." >&2; return; fi
  read -r -p "Backend server IP: " BIP
  read -r -p "Backend server port: " BPORT
  if ! valid_port "$BPORT"; then echo "Invalid port, aborting." >&2; return; fi

  grep -v "^${LABEL}|" "$UDP_RULES" > "$UDP_RULES.tmp" 2>/dev/null || true
  mv "$UDP_RULES.tmp" "$UDP_RULES"
  echo "${LABEL}|${LPORT}|${BIP}|${BPORT}" >> "$UDP_RULES"
  echo "Saved. Run 'Apply / reload' from the menu to activate it."
}

list_rules() {
  echo
  echo "TCP relays (HAProxy, real client IP preserved via PROXY protocol v2):"
  if [ -s "$TCP_RULES" ]; then
    while IFS='|' read -r LABEL LPORT BIP BPORT; do
      [ -z "$LABEL" ] && continue
      echo "  $LABEL: this:$LPORT -> $BIP:$BPORT"
    done < "$TCP_RULES"
  else
    echo "  (none)"
  fi
  echo
  echo "UDP/QUIC relays (iptables DNAT, real client IP NOT preserved):"
  if [ -s "$UDP_RULES" ]; then
    while IFS='|' read -r LABEL LPORT BIP BPORT; do
      [ -z "$LABEL" ] && continue
      echo "  $LABEL: this:$LPORT -> $BIP:$BPORT"
    done < "$UDP_RULES"
  else
    echo "  (none)"
  fi
}

remove_rule() {
  list_rules
  echo
  read -r -p "Label to remove: " LABEL
  grep -v "^${LABEL}|" "$TCP_RULES" > "$TCP_RULES.tmp" 2>/dev/null || true
  mv "$TCP_RULES.tmp" "$TCP_RULES"
  grep -v "^${LABEL}|" "$UDP_RULES" > "$UDP_RULES.tmp" 2>/dev/null || true
  mv "$UDP_RULES.tmp" "$UDP_RULES"
  echo "Removed '$LABEL' (if it existed). Run 'Apply / reload' to activate."
}

apply_rules() {
  echo
  echo "Applying relay rules..."

  # --- TCP via HAProxy ---
  if [ -s "$TCP_RULES" ]; then
    ensure_haproxy
    if [ ! -f "${HAPROXY_CFG}.orig" ] && [ -f "$HAPROXY_CFG" ]; then
      cp "$HAPROXY_CFG" "${HAPROXY_CFG}.orig"
    fi
    {
      echo "# Managed by marzban relay_setup.sh -- do not edit by hand"
      echo "global"
      echo "    maxconn 50000"
      echo "    log /dev/log local0"
      echo
      echo "defaults"
      echo "    mode tcp"
      echo "    timeout connect 5s"
      echo "    timeout client 5m"
      echo "    timeout server 5m"
      echo
      while IFS='|' read -r LABEL LPORT BIP BPORT; do
        [ -z "$LABEL" ] && continue
        echo "frontend ${LABEL}_in"
        echo "    bind *:${LPORT}"
        echo "    default_backend ${LABEL}_out"
        echo
        echo "backend ${LABEL}_out"
        echo "    server ${LABEL}_srv ${BIP}:${BPORT} send-proxy-v2"
        echo
        open_firewall_port "$LPORT" tcp
      done < "$TCP_RULES"
    } > "$HAPROXY_CFG"
    systemctl enable haproxy >/dev/null 2>&1 || true
    systemctl restart haproxy
    echo "HAProxy: $(grep -c '^frontend' "$HAPROXY_CFG") TCP relay(s) active."
  else
    if command -v haproxy >/dev/null 2>&1; then
      systemctl stop haproxy 2>/dev/null || true
    fi
  fi

  # --- UDP via iptables DNAT ---
  sed -i '/^net.ipv4.ip_forward/d' /etc/sysctl.conf
  echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
  sysctl -w net.ipv4.ip_forward=1 >/dev/null

  iptables -t nat -F MZ_RELAY_UDP 2>/dev/null || iptables -t nat -N MZ_RELAY_UDP
  iptables -t nat -D PREROUTING -j MZ_RELAY_UDP 2>/dev/null || true
  iptables -t nat -A PREROUTING -j MZ_RELAY_UDP

  iptables -t nat -F MZ_RELAY_UDP_POST 2>/dev/null || iptables -t nat -N MZ_RELAY_UDP_POST
  iptables -t nat -D POSTROUTING -j MZ_RELAY_UDP_POST 2>/dev/null || true
  iptables -t nat -A POSTROUTING -j MZ_RELAY_UDP_POST

  if [ -s "$UDP_RULES" ]; then
    ensure_iptables_persistent
    while IFS='|' read -r LABEL LPORT BIP BPORT; do
      [ -z "$LABEL" ] && continue
      iptables -t nat -A MZ_RELAY_UDP -p udp --dport "$LPORT" -j DNAT --to-destination "${BIP}:${BPORT}"
      iptables -t nat -A MZ_RELAY_UDP_POST -p udp -d "$BIP" --dport "$BPORT" -j MASQUERADE
      open_firewall_port "$LPORT" udp
    done < "$UDP_RULES"
    netfilter-persistent save >/dev/null 2>&1 || true
    echo "iptables: $(wc -l < "$UDP_RULES") UDP relay(s) active."
  fi

  echo "Done."
}

print_backend_instructions() {
  cat <<'EOF'

=== What to change on each BACKEND server (Sweden/Norway/Netherlands) ===

For every TCP relay above, the backend's Xray inbound that receives the
relayed connections must accept PROXY protocol v2, otherwise it will
reject the connection (or lose the real client IP). In the Marzban
dashboard on that backend -> Core Settings (Xray config JSON), find the
inbound this relay forwards to and add "sockopt" to it, e.g.:

  {
    "tag": "VLESS TCP",
    "listen": "0.0.0.0",
    "port": 443,
    "protocol": "vless",
    "streamSettings": {
      "network": "tcp",
      "sockopt": {
        "acceptProxyProtocol": true
      }
    },
    ...
  }

IMPORTANT: once acceptProxyProtocol is enabled on an inbound, that inbound
will ONLY accept connections that arrive via a relay sending the PROXY
protocol header (like the HAProxy this script sets up) -- direct
connections without it will be rejected. If you still want some users to
connect to that backend directly (without the relay), duplicate the
inbound onto a second port and only enable acceptProxyProtocol on the
copy used for relaying.

UDP/QUIC relays (iptables DNAT) need no backend-side change.

=== What to change in the Marzban dashboard (Hosts) ===

For users who should connect through this relay, add/edit a Host entry
for that inbound with:
  Address = this relay server's IP (or a domain pointing to it)
  Port    = the relay port you chose above (e.g. 8443)

Users on that host will now reach the backend transparently through
this relay. If this relay's own IP later gets blocked too, just point
that Host's Address at a new relay server -- no backend changes needed.
EOF
}

# --- menu -----------------------------------------------------------------

echo "=== Marzban Relay Setup ==="
while true; do
  echo
  echo "1) Add TCP relay (HAProxy + PROXY protocol, preserves client IP)"
  echo "2) Add UDP/QUIC relay (iptables DNAT, client IP NOT preserved)"
  echo "3) List configured relays"
  echo "4) Remove a relay"
  echo "5) Apply / reload"
  echo "6) Show backend + dashboard instructions"
  echo "7) Exit"
  read -r -p "Choice: " CHOICE
  case "$CHOICE" in
    1) add_tcp_rule ;;
    2) add_udp_rule ;;
    3) list_rules ;;
    4) remove_rule ;;
    5) apply_rules ;;
    6) print_backend_instructions ;;
    7) break ;;
    *) echo "Invalid choice." ;;
  esac
done
