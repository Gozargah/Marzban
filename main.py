import uvicorn
from app import app
from config import (
    DEBUG,
    UVICORN_HOST,
    UVICORN_PORT,
    UVICORN_UDS,
    UVICORN_SSL_CERTFILE,
    UVICORN_SSL_KEYFILE
)


if __name__ == "__main__":
    # Do NOT change workers count for now
    # multi-workers support isn't implemented yet for APScheduler and XRay module
    uvicorn.run(
        "main:app",
        host=('127.0.0.1' if DEBUG else UVICORN_HOST),
        port=UVICORN_PORT,
        uds=(None if DEBUG else UVICORN_UDS),
        ssl_certfile=UVICORN_SSL_CERTFILE,
        ssl_keyfile=UVICORN_SSL_KEYFILE,
        workers=1,
        reload=DEBUG
    )
