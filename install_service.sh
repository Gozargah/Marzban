#!/bin/bash

SERVICE_NAME="marzban"
SERVICE_DESCRIPTION="Marzban Service"
SERVICE_DOCUMENTATION="https://github.com/gozargah/marzban"
MAIN_PY_PATH="$PWD/main.py"
APP_DIR="$PWD"
UV_PATH="$(command -v uv)"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"

if [ -z "$UV_PATH" ]; then
    echo "uv is required to install the Marzban service" >&2
    exit 1
fi

"$UV_PATH" sync --project "$APP_DIR" --locked --no-dev || exit 1

# Create the service file
cat > $SERVICE_FILE <<EOF
[Unit]
Description=$SERVICE_DESCRIPTION
Documentation=$SERVICE_DOCUMENTATION
After=network.target nss-lookup.target

[Service]
ExecStart=$APP_DIR/.venv/bin/python $MAIN_PY_PATH
Restart=on-failure
WorkingDirectory=$PWD

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

echo "Service file created at: $SERVICE_FILE"
