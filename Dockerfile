FROM gozargah/marzban:latest

ENV UVICORN_PORT=8000
EXPOSE 8000

CMD ["python3", "-m", "alembic", "upgrade", "head", "&&", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
