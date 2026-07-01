FROM gozargah/marzban:latest

# تنظیمات محیطی
ENV UVICORN_HOST=0.0.0.0
ENV UVICORN_PORT=8000
ENV SQLALCHEMY_DATABASE_URL=sqlite:////var/lib/marzban/db.sqlite3
ENV XRAY_SUBSCRIPTION_URL_PREFIX=https://panel.yourdomain.com

VOLUME /var/lib/marzban
EXPOSE 8000

CMD ["marzban", "run"]
