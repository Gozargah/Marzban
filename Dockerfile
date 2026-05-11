FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /code

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl unzip gcc python3-dev libpq-dev \
    && curl -L https://github.com/Gozargah/Marzban-scripts/raw/master/install_latest_xray.sh | bash \
    && rm -rf /var/lib/apt/lists/*

COPY ./requirements.txt /code/
RUN pip install --no-cache-dir --upgrade pip setuptools \
    && pip install --no-cache-dir -r /code/requirements.txt

COPY . /code

RUN ln -s /code/marzban-cli.py /usr/bin/marzban-cli \
    && chmod +x /usr/bin/marzban-cli \
    && marzban-cli completion install --shell bash

CMD ["bash", "-c", "alembic upgrade head; python main.py"]
