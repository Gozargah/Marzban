ARG PYTHON_VERSION=3.12
ARG XRAY_VERSION=v26.3.27

# Stage 1: Frontend build
FROM node:16.17.0-slim AS frontend
WORKDIR /dashboard
COPY ./app/dashboard/package.json ./app/dashboard/package-lock.json ./
RUN npm ci
COPY ./app/dashboard/ ./
RUN VITE_BASE_API=/api/ npm run build -- --outDir build --assetsDir statics \
    && cp ./build/index.html ./build/404.html

# Stage 2: Python dependencies + xray
FROM python:${PYTHON_VERSION}-slim AS build
ARG XRAY_VERSION
ENV PYTHONUNBUFFERED=1
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /code

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential gcc python3-dev libpq-dev curl unzip ca-certificates \
    && update-ca-certificates \
    && curl -fsSL https://github.com/npvpn/Marzban-scripts/raw/master/install_latest_xray.sh | bash -s -- "$XRAY_VERSION" \
    && rm -rf /var/lib/apt/lists/*

ENV UV_PROJECT_ENVIRONMENT=/code/.venv
COPY pyproject.toml uv.lock /code/
RUN uv sync --frozen --no-dev --no-install-project

# Stage 3: Final image
FROM python:${PYTHON_VERSION}-slim
ENV PYTHONUNBUFFERED=1
ENV UV_PROJECT_ENVIRONMENT=/code/.venv
ENV PATH="/code/.venv/bin:$PATH"
WORKDIR /code

# uv нужен и в рантайме: в venv, созданном uv sync, нет pip, поэтому доустановка
# пакетов (например debugpy в dev-режиме) идёт через `uv pip install`.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
COPY --from=build /code/.venv /code/.venv
RUN mkdir -p /usr/local/share/xray
COPY --from=build /usr/local/bin/xray /usr/local/bin/xray
COPY --from=build /usr/local/share/xray /usr/local/share/xray
COPY . /code
COPY --from=frontend /dashboard/build/ /code/app/dashboard/build/
COPY ./app/dashboard/public/statics/ /code/app/dashboard/build/statics/

RUN ln -sf /code/marzban-cli.py /usr/bin/marzban-cli || true \
    && chmod +x /usr/bin/marzban-cli || true \
    && marzban-cli completion install --shell bash || true

CMD ["bash", "-c", "alembic upgrade head && python /code/main.py"]