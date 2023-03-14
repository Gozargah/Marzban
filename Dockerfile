FROM python:3.10-slim

ENV PYTHONUNBUFFERED 1

WORKDIR /code

RUN apt-get update \
    && apt-get install -y curl unzip gcc python3-dev \
    && rm -rf /var/lib/apt/lists/*

RUN curl -L https://github.com/Gozargah/Marzban-scripts/raw/master/install_latest_xray.sh | bash

COPY . /code

RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

RUN apt-get remove -y curl unzip gcc python3-dev

RUN ln -s /code/marzban-cli.py /usr/bin/marzban-cli \
    && chmod +x /usr/bin/marzban-cli \
    && marzban-cli --install-completion bash

CMD ["bash", "-c", "alembic upgrade head; python main.py"]