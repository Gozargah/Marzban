#!/bin/sh
set -eu

CONFIG_PATH="${MTPROTO_CONFIG_PATH:-/var/lib/marzban/mtproto/config.toml}"
POLL_INTERVAL="${MTPROTO_RELOAD_INTERVAL:-5}"

child_pid=""
current_hash=""

cleanup() {
  if [ -n "$child_pid" ] && kill -0 "$child_pid" 2>/dev/null; then
    kill "$child_pid" 2>/dev/null || true
    wait "$child_pid" 2>/dev/null || true
  fi
  exit 0
}

trap cleanup INT TERM

start_proxy() {
  /usr/local/bin/telemt "$CONFIG_PATH" &
  child_pid="$!"
}

stop_proxy() {
  if [ -n "$child_pid" ] && kill -0 "$child_pid" 2>/dev/null; then
    kill "$child_pid" 2>/dev/null || true
    wait "$child_pid" 2>/dev/null || true
  fi
  child_pid=""
}

while true; do
  if [ ! -f "$CONFIG_PATH" ]; then
    sleep "$POLL_INTERVAL"
    continue
  fi

  next_hash="$(sha256sum "$CONFIG_PATH" | awk '{print $1}')"

  if [ "$next_hash" != "$current_hash" ]; then
    stop_proxy
    start_proxy
    current_hash="$next_hash"
  elif [ -z "$child_pid" ] || ! kill -0 "$child_pid" 2>/dev/null; then
    start_proxy
  fi

  sleep "$POLL_INTERVAL"
done
