FROM python:3.10-slim

ENV PYTHONUNBUFFERED 1

WORKDIR /code

RUN apt-get update \
    && apt-get install -y wget gcc python3-dev \
    && rm -rf /var/lib/apt/lists/*
RUN wget -O - https://raw.githubusercontent.com/teddysun/across/master/docker/xray/xray.sh | bash \
    && ln -s /usr/bin/xray /usr/local/bin/xray \
    && mkdir -p /usr/local/share/xray/ \
    && wget -O /usr/local/share/xray/geosite.dat https://github.com/v2fly/domain-list-community/releases/latest/download/dlc.dat \
    && wget -O /usr/local/share/xray/geoip.dat https://github.com/v2fly/geoip/releases/latest/download/geoip.dat

COPY . /code

RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

RUN apt-get remove -y wget gcc python3-dev

CMD ["bash", "-c", "alembic upgrade head; python main.py"]