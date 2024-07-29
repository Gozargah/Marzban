#!/usr/bin/env bash

# get environment variabls from .env
set -o allexport
source ./.env
set +o allexport

DASH_PATH="/$DASHBOARD_PATH/"

# build project
cd "$(dirname "$0")/app/dashboard" || exit
VITE_BASE_API=/api/ npm run build --if-present -- --outDir build --base "$DASH_PATH"
cp ./build/index.html ./build/404.html
echo "$DASH_PATH" > ./build/last_path