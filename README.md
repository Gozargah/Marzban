## How to run

Install Xray-core using [Xray-install](https://github.com/XTLS/Xray-install)
    
    bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install

Run the server

    pip install -r requirements.txt
    alembic upgrade head
    python main.py

Swagger documentation will be available on `http://SERVER_IP:8000/docs`