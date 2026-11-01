ARG PYTHON_VERSION=3.12

FROM python:$PYTHON_VERSION-slim AS build

COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

WORKDIR /code

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl unzip gcc python3-dev libpq-dev \
    && curl -L https://github.com/Gozargah/Marzban-scripts/raw/master/install_latest_xray.sh | bash \
    && rm -rf /var/lib/apt/lists/*

COPY ./pyproject.toml ./uv.lock /code/
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-install-project

FROM python:$PYTHON_VERSION-slim

WORKDIR /code

COPY --from=build /code/.venv /code/.venv
COPY --from=build /usr/local/bin/xray /usr/local/bin/xray
COPY --from=build /usr/local/share/xray /usr/local/share/xray

COPY . /code

ENV PATH="/code/.venv/bin:$PATH"

RUN printf '#!/bin/sh\nexec /code/.venv/bin/python /code/marzban-cli.py "$@"\n' > /usr/bin/marzban-cli \
    && chmod +x /usr/bin/marzban-cli \
    && /usr/bin/marzban-cli completion install --shell bash

CMD ["bash", "-c", "alembic upgrade head && python main.py"]
