ARG PYTHON_VERSION=3.12

# Borrow the pre-built Xray binary from the official Marzban image
FROM gozargah/marzban:latest AS marzban-xray

FROM python:$PYTHON_VERSION-slim AS build

ENV PYTHONUNBUFFERED=1

WORKDIR /code

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential gcc python3-dev libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the Xray binary and geo assets
COPY --from=marzban-xray /usr/local/bin/xray /usr/local/bin/xray
COPY --from=marzban-xray /usr/local/share/xray /usr/local/share/xray

COPY ./requirements.txt /code/
RUN python3 -m pip install --upgrade pip "setuptools<81" \
    && pip install --no-cache-dir --upgrade -r /code/requirements.txt

FROM python:$PYTHON_VERSION-slim

ENV PYTHON_LIB_PATH=/usr/local/lib/python${PYTHON_VERSION%.*}/site-packages
WORKDIR /code

RUN rm -rf $PYTHON_LIB_PATH/*

COPY --from=build $PYTHON_LIB_PATH $PYTHON_LIB_PATH
COPY --from=build /usr/local/bin /usr/local/bin
COPY --from=build /usr/local/share/xray /usr/local/share/xray

COPY . /code

RUN python3 -m pip install --no-cache-dir --upgrade "setuptools<81"

RUN ln -s /code/marzban-cli.py /usr/bin/marzban-cli \
    && chmod +x /usr/bin/marzban-cli \
    && (marzban-cli completion install --shell bash || true)

CMD ["bash", "-c", "alembic upgrade head; python main.py"]
