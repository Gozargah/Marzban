#!/usr/bin/env bash
#
# install_xray.sh — install Xray-core at a pinned version.
#
# Usage:
#   install_xray.sh [--version <tag>]
#
# Resolution order for the version:
#   1. --version <tag> CLI arg
#   2. XRAY_VERSION env var
#   3. Built-in default (kept in sync with the Dockerfile ARG)
#
# This replaces the upstream `install_latest_xray.sh` which silently
# tracked latest. v0.9.0 pins the binary so that rebuilding the panel
# image produces the same Xray version unless explicitly bumped.
#
# The old filename `install_latest_xray.sh` is kept in this directory as
# a symlink so any external automation pointing at the historical name
# keeps working; it is DEPRECATED and will be removed in v1.0.

set -euo pipefail

DEFAULT_VERSION="v26.2.6"
VERSION="${XRAY_VERSION:-$DEFAULT_VERSION}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --version)
            if [[ $# -lt 2 ]]; then
                echo "error: --version requires a tag argument" >&2
                exit 2
            fi
            VERSION="$2"
            shift 2
            ;;
        -h|--help)
            sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo "error: unknown argument: $1" >&2
            exit 2
            ;;
    esac
done

ARCH="$(uname -m)"
case "$ARCH" in
    x86_64)            XRAY_ARCH="64" ;;
    aarch64|arm64)     XRAY_ARCH="arm64-v8a" ;;
    armv7l)            XRAY_ARCH="arm32-v7a" ;;
    armv6l)            XRAY_ARCH="arm32-v6" ;;
    i386|i686)         XRAY_ARCH="32" ;;
    *)
        echo "error: unsupported architecture: $ARCH" >&2
        exit 1
        ;;
esac

URL="https://github.com/XTLS/Xray-core/releases/download/${VERSION}/Xray-linux-${XRAY_ARCH}.zip"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "Installing Xray ${VERSION} (${XRAY_ARCH}) from ${URL}"
curl --fail --location --silent --show-error -o "$TMPDIR/xray.zip" "$URL"

ASSETS_DIR="${XRAY_ASSETS_PATH:-/usr/local/share/xray}"
BIN_PATH="${XRAY_EXECUTABLE_PATH:-/usr/local/bin/xray}"

mkdir -p "$ASSETS_DIR"
unzip -q -o "$TMPDIR/xray.zip" -d "$ASSETS_DIR"
install -m 0755 "$ASSETS_DIR/xray" "$BIN_PATH"

echo "Installed: $("$BIN_PATH" version | head -n 1)"
