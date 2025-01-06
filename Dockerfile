ARG PYTHON_VERSION=3.12

FROM python:$PYTHON_VERSION-slim AS build

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1

WORKDIR /code

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl unzip gcc libpq-dev \
    && curl -L https://github.com/Gozargah/Marzban-scripts/raw/master/install_latest_xray.sh | bash \
    && rm -rf /var/lib/apt/lists/*


FROM python:$PYTHON_VERSION-slim

WORKDIR /code

COPY --from=build /usr/local/bin /usr/local/bin
COPY --from=build /usr/local/share/xray /usr/local/share/xray

COPY . /code

RUN uv sync \
    && ln -s /code/marzban-cli.py /usr/bin/marzban-cli \
    && chmod +x /usr/bin/marzban-cli \
    && marzban-cli completion install --shell bash

CMD ["bash", "-c", "uv run alembic upgrade head; uv run main.py"]
