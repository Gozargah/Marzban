#!/usr/bin/env bash

# get environment variabls from .env
set -o allexport
source ./.env
set +o allexport

# build project
cd "$(dirname "$0")/app/dashboard" || exit
VITE_BASE_API=/api/ npm run build --if-present -- --outDir build --base $DASHBOARD_PATH
cp ./build/index.html ./build/404.html
echo $DASHBOARD_PATH > ./build/last_path