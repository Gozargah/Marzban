#!/bin/bash

SERVICE_NAME="marzban"
SERVICE_DESCRIPTION="Marzban Service"
SERVICE_DOCUMENTATION="https://github.com/gozargah/marzban"
MAIN_PY_PATH="$PWD/main.py"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"

# Create the service file
cat > $SERVICE_FILE <<EOF
[Unit]
Description=$SERVICE_DESCRIPTION
Documentation=$SERVICE_DOCUMENTATION
After=network.target nss-lookup.target

[Service]
ExecStart=/usr/bin/env python3 $MAIN_PY_PATH
Restart=on-failure
WorkingDirectory=$PWD

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

echo "Service file created at: $SERVICE_FILE"
