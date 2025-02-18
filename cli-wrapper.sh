#!/bin/bash
# Wrapper script to run marzban-cli with uv
UV_PATH="/bin/uv"
SCRIPT_PATH="/code/marzban-cli.py"

$UV_PATH run $SCRIPT_PATH "$@"