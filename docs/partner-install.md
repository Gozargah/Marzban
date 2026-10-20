# Партнёрская установка

Полная автоматическая установка: UFW, certbot, MySQL, SSL, порт 8001, админ панели.

**Перед запуском:** создайте администратора в админке бота и скопируйте логин, MySQL-пароль и хэш пароля.  
Подробнее: [Установка панели для партнера.md](https://github.com/npvpn/Marzban-scripts/blob/master/%D0%A3%D1%81%D1%82%D0%B0%D0%BD%D0%BE%D0%B2%D0%BA%D0%B0%20%D0%BF%D0%B0%D0%BD%D0%B5%D0%BB%D0%B8%20%D0%B4%D0%BB%D1%8F%20%D0%BF%D0%B0%D1%80%D1%82%D0%BD%D0%B5%D1%80%D0%B0.md)

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban.sh)" @ install-partner
```

С параметрами (без интерактивных вопросов):

```bash
sudo bash -c "$(curl -sL https://github.com/npvpn/Marzban-scripts/raw/master/marzban.sh)" @ install-partner \
  --domain your-domain.tld \
  --cert-email admin@example.com \
  --mysql-password 'YOUR_MYSQL_PASSWORD' \
  --admin-username partner_admin \
  --admin-password-hash '$argon2id$...' \
  --subscription-title 'My VPN' \
  --support-telegram support_bot \
  --bot-telegram my_vpn_bot \
  --token 'GITHUB_RUNNER_REGISTRATION_TOKEN' \
  --non-interactive
```

`--token` — registration token GitHub runner’а; его выдаёт команда npvpn при подключении партнёра. Опционально: `--project-dir /opt/marzban`, `--skip-runner`.

Панель будет доступна по адресу: `https://<домен>:8001/dashboard/`

**Обновление панели на партнёрах** выполняет команда npvpn: образ собирается в этом репозитории и раскатывается на партнёрские серверы централизованно. Вопросы по доступу и подключению — [t.me/npvpn](https://t.me/npvpn).
