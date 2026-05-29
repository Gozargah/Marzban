ARG PYTHON_VERSION=3.12
# Keep this default in sync with scripts/install_xray.sh DEFAULT_VERSION.
ARG XRAY_VERSION=v26.2.6

FROM python:$PYTHON_VERSION-slim AS build

ENV PYTHONUNBUFFERED=1
ARG XRAY_VERSION

WORKDIR /code

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl unzip gcc python3-dev libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Xray at a pinned version (v0.9.0: was previously "latest" via
# upstream install_latest_xray.sh — see CHANGELOG and CODEBASE_MAP §6).
COPY scripts/install_xray.sh /tmp/install_xray.sh
RUN bash /tmp/install_xray.sh --version "$XRAY_VERSION"

COPY ./requirements.txt /code/
# setuptools<81 pin: setuptools 81 removed pkg_resources, which
# APScheduler 3.9.1 still imports at module import time. Without this
# pin, `pip install --upgrade setuptools` here installs 82+ and the
# final-stage `marzban-cli completion install` fails at import with
# ModuleNotFoundError: No module named 'pkg_resources'. Same root
# cause as the Task 1 CI bootstrap pin in .github/workflows/ci.yml —
# Task 1 missed the Dockerfile; this is the matching fix.
RUN python3 -m pip install --upgrade pip 'setuptools<81' wheel \
    && pip install --no-cache-dir --upgrade -r /code/requirements.txt

FROM python:$PYTHON_VERSION-slim

ENV PYTHON_LIB_PATH=/usr/local/lib/python${PYTHON_VERSION%.*}/site-packages
WORKDIR /code

RUN rm -rf $PYTHON_LIB_PATH/*

COPY --from=build $PYTHON_LIB_PATH $PYTHON_LIB_PATH
COPY --from=build /usr/local/bin /usr/local/bin
COPY --from=build /usr/local/share/xray /usr/local/share/xray

COPY . /code

RUN ln -s /code/marzban-cli.py /usr/bin/marzban-cli \
    && chmod +x /usr/bin/marzban-cli \
    && marzban-cli completion install --shell bash

CMD ["bash", "-c", "alembic upgrade head; python main.py"]
