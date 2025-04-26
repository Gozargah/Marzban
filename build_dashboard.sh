cd "$(dirname "$0")/dashboard"
VITE_BASE_API=/ pnpm run build
cp ./build/index.html ./build/404.html
 