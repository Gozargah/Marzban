ARG PYTHON_VERSION=3.12
ARG XRAY_VERSION=v26.2.6

FROM alpine:latest AS xray-build
ARG XRAY_VERSION
RUN apk add --no-cache wget unzip \
    && wget -qO /tmp/xray.zip \
       "https://github.com/XTLS/Xray-core/releases/download/${XRAY_VERSION}/Xray-linux-64.zip" \
    && mkdir -p /tmp/xray \
    && unzip /tmp/xray.zip -d /tmp/xray \
    && chmod +x /tmp/xray/xray

FROM python:$PYTHON_VERSION-slim AS build

ENV PYTHONUNBUFFERED=1

WORKDIR /code

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential gcc python3-dev libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=xray-build /tmp/xray/xray /usr/local/bin/xray
COPY --from=xray-build /tmp/xray/geoip.dat /usr/local/share/xray/geoip.dat
COPY --from=xray-build /tmp/xray/geosite.dat /usr/local/share/xray/geosite.dat

COPY ./requirements.txt /code/
RUN python3 -m pip install --upgrade pip "setuptools<81" \
    && pip install --no-cache-dir --upgrade -r /code/requirements.txt

FROM python:$PYTHON_VERSION-slim

ENV PYTHON_LIB_PATH=/usr/local/lib/python${PYTHON_VERSION%.*}/site-packages
WORKDIR /code

RUN rm -rf $PYTHON_LIB_PATH/*

COPY --from=build $PYTHON_LIB_PATH $PYTHON_LIB_PATH
COPY --from=build /usr/local/bin /usr/local/bin
COPY --from=xray-build /tmp/xray/xray /usr/local/bin/xray
COPY --from=xray-build /tmp/xray/geoip.dat /usr/local/share/xray/geoip.dat
COPY --from=xray-build /tmp/xray/geosite.dat /usr/local/share/xray/geosite.dat

COPY . /code

RUN python3 -m pip install --no-cache-dir --upgrade "setuptools<81"

RUN ln -s /code/marzban-cli.py /usr/bin/marzban-cli \
    && chmod +x /usr/bin/marzban-cli \
    && (marzban-cli completion install --shell bash || true)

CMD ["bash", "-c", "alembic upgrade head; python main.py"]
