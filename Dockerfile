FROM python:3.10-slim

ENV PYTHONUNBUFFERED 1

WORKDIR /code

RUN apt-get update \
    && apt-get install -y curl unzip gcc python3-dev \
    && rm -rf /var/lib/apt/lists/*

RUN bash -c "$(curl -L https://github.com/GFWFuckers/MarzGosha-scripts/raw/master/install_latest_xray.sh)"

COPY ./requirements.txt /code/
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

COPY . /code

RUN apt-get remove -y curl unzip gcc python3-dev

RUN ln -s /code/marzgosha-cli.py /usr/bin/marzgosha-cli \
    && chmod +x /usr/bin/marzgosha-cli \
    && marzgosha-cli completion install --shell bash

CMD ["bash", "-c", "alembic upgrade head; python main.py"]