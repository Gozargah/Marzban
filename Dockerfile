ARG PYTHON_VERSION=3.12

FROM python:$PYTHON_VERSION-slim AS build

ENV PYTHONUNBUFFERED=1

WORKDIR /code

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl unzip gcc libpq-dev \
    && curl -L https://github.com/Gozargah/Marzban-scripts/raw/master/install_latest_xray.sh | bash \
    && rm -rf /var/lib/apt/lists/

FROM python:$PYTHON_VERSION-slim

# Set up the working directory

RUN mkdir /code
WORKDIR /code
COPY . /code

RUN sed -i 's/\r$//' /code/marzban-cli.py

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

COPY --from=build /usr/local/bin /usr/local/bin
COPY --from=build /usr/local/share/xray /usr/local/share/xray

RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen

COPY cli-wrapper.sh /usr/bin/marzban-cli
RUN chmod +x /usr/bin/marzban-cli
RUN /usr/bin/marzban-cli completion install --shell bash

# Set the entrypoint
ENTRYPOINT ["bash", "-c", "uv run alembic upgrade head"]
CMD ["bash", "-c", "uv run main.py"]
