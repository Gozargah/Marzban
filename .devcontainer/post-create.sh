#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

pip install --no-cache-dir -r requirements.txt

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i 's|^# SQLALCHEMY_DATABASE_URL.*|SQLALCHEMY_DATABASE_URL = "sqlite:///db.sqlite3"|' .env
fi

echo "Setup complete. Run 'python main.py' to start Marzban, then create an admin with:"
echo "  python marzban-cli.py admin create --sudo"
