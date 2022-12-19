import uvicorn
from app import app
from config import DEBUG, UVICORN_HOST, UVICORN_PORT


if __name__ == "__main__":
    # Do NOT change workers count for now
    # multi-workers support isn't implemented yet for APScheduler and XRay module
    uvicorn.run(
        "main:app",
        host=('127.0.0.1' if DEBUG else UVICORN_HOST),
        port=UVICORN_PORT,
        workers=1,
        reload=DEBUG
    )
