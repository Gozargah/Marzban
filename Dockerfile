ARG PYTHON_VERSION=3.12
ARG NODE_VERSION=24

FROM --platform=$BUILDPLATFORM node:$NODE_VERSION-slim AS dashboard

WORKDIR /dashboard

RUN corepack enable

# Dependencies first: they only change when the lockfile does.
COPY app/dashboard/package.json app/dashboard/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY app/dashboard/ ./
RUN VITE_BASE_API=/api/ pnpm run build --outDir build --assetsDir statics \
    && cp build/index.html build/404.html

FROM python:$PYTHON_VERSION-slim AS build

ENV PYTHONUNBUFFERED=1

WORKDIR /code

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl unzip gcc python3-dev libpq-dev \
    && curl -L https://github.com/Gozargah/Marzban-scripts/raw/master/install_latest_xray.sh | bash \
    && rm -rf /var/lib/apt/lists/*

COPY ./requirements.txt /code/
RUN python3 -m pip install --upgrade pip setuptools \
    && pip install --no-cache-dir --upgrade -r /code/requirements.txt

# certbot lives in its own virtualenv: it wants newer acme/josepy/pyOpenSSL
# than the panel pins, and pip cannot satisfy both in one environment.
RUN python3 -m venv /opt/certbot \
    && /opt/certbot/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/certbot/bin/pip install --no-cache-dir certbot==5.7.0

FROM python:$PYTHON_VERSION-slim

ENV PYTHON_LIB_PATH=/usr/local/lib/python${PYTHON_VERSION%.*}/site-packages
WORKDIR /code

# nginx is here for its binary, not to be run as a service: the panel uses it to
# check the host's configuration and to signal the host's master process. Keep
# it to the same package Debian and Ubuntu install by default, so `nginx -t`
# understands the same directives the host's build does.
#
# procps is what carries sysctl(8). The slim base does not have it, and without
# it the System settings screen writes /etc/sysctl.d/99-xenith.conf and then
# fails to apply it, since SYSCTL_EXECUTABLE_PATH resolves a bare `sysctl`
# through PATH.
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx-core procps \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

RUN rm -rf $PYTHON_LIB_PATH/*

COPY --from=build $PYTHON_LIB_PATH $PYTHON_LIB_PATH
COPY --from=build /usr/local/bin /usr/local/bin
COPY --from=build /usr/local/share/xray /usr/local/share/xray
COPY --from=build /opt/certbot /opt/certbot

RUN ln -s /opt/certbot/bin/certbot /usr/local/bin/certbot

COPY . /code
COPY --from=dashboard /dashboard/build /code/app/dashboard/build

# skypanel-cli and marzban-cli stay as aliases so existing scripts keep working.
RUN ln -s /code/xenith-cli.py /usr/bin/xenith-cli \
    && chmod +x /usr/bin/xenith-cli \
    && ln -s /usr/bin/xenith-cli /usr/bin/skypanel-cli \
    && ln -s /usr/bin/xenith-cli /usr/bin/marzban-cli \
    && xenith-cli completion install --shell bash

# `&&`, not `;`: a migration that fails leaves the database on a schema the
# panel does not expect, and starting anyway turns that into a stream of
# query errors instead of one loud failure the restart loop makes visible.
CMD ["bash", "-c", "alembic upgrade head && python main.py"]
