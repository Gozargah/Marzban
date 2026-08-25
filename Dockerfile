ARG PYTHON_VERSION=3.14

FROM python:$PYTHON_VERSION-slim

ENV PYTHONUNBUFFERED=1


RUN apt-get update \
&& apt-get install -y --no-install-recommends build-essential curl unzip gcc python3-dev libpq-dev \
&& rm -rf /var/lib/apt/lists/* \
&& curl -L https://github.com/darkringfire/Marzban/raw/master/scripts/marzban.sh | bash

COPY ./requirements.txt /code/requirements.txt
RUN python3 -m pip install --upgrade pip setuptools \
&& pip install --no-cache-dir --upgrade -r /code/requirements.txt
COPY . /code

WORKDIR /code

RUN ln -s /code/marzban-cli.py /usr/bin/marzban-cli \
&& chmod +x /usr/bin/marzban-cli \
&& marzban-cli completion install --shell bash

CMD ["bash", "-c", "alembic upgrade head; python main.py"]
