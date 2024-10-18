cd `dirname $0`/app/dashboard
VITE_BASE_API=/api/ npm run build --if-present -- --outDir build --assetsDir statics
cp ./build/index.html ./build/404.html