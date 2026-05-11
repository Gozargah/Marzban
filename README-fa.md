<p align="center">
  <a href="https://github.com/gozargah/marzban" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/Gozargah/Marzban-docs/raw/master/screenshots/logo-dark.png">
      <img width="160" height="160" src="https://github.com/Gozargah/Marzban-docs/raw/master/screenshots/logo-light.png">
    </picture>
  </a>
</p>

<h1 align="center"/>NeonGate</h1>

<p align="center">
     راه حل یکپارچه برای مدیریت پروتکل های مختلف. قدرت گرفته از <a href="https://github.com/XTLS/Xray-core">Xray</a>
</p>

<br/>
<p align="center">
    <a href="#">
        <img src="https://img.shields.io/github/actions/workflow/status/gozargah/marzban/build.yml?style=flat-square" />
    </a>
    <a href="https://hub.docker.com/r/gozargah/marzban" target="_blank">
        <img src="https://img.shields.io/docker/pulls/gozargah/marzban?style=flat-square&logo=docker" />
    </a>
    <a href="#">
        <img src="https://img.shields.io/github/license/gozargah/marzban?style=flat-square" />
    </a>
    <a href="https://t.me/gozargah_marzban" target="_blank">
        <img src="https://img.shields.io/badge/telegram-group-blue?style=flat-square&logo=telegram" />
    </a>
    <a href="#">
        <img src="https://img.shields.io/badge/twitter-commiunity-blue?style=flat-square&logo=twitter" />
    </a>
    <a href="#">
        <img src="https://img.shields.io/github/stars/gozargah/marzban?style=social" />
    </a>
</p>

<p align="center">
	<a href="./README.md">
	English
	</a>
	/
	<a href="./README-fa.md">
	فارسی
	</a>
  /
  <a href="./README-zh-cn.md">
	简体中文
	</a>
   /
  <a href="./README-ru.md">
 Русский
 </a>
</p>

<p align="center">
  <a href="https://github.com/gozargah/marzban" target="_blank" rel="noopener noreferrer" >
    <img src="https://github.com/Gozargah/Marzban-docs/raw/master/screenshots/preview.png" alt="Elk screenshots" width="600" height="auto">
  </a>
</p>

## فهرست مطالب

- [بررسی اجمالی](#بررسی-اجمالی)
  - [چرا مرزبان؟](#چرا-مرزبان)
    - [امکانات](#امکانات)
- [راهنمای نصب](#راهنمای-نصب)
- [تنظیمات](#تنظیمات)
- [داکیومنت](#داکیومنت)
- [استفاده از API](#استفاده-از-api)
- [پشتیبان گیری از مرزبان](#پشتیبان-گیری-از-مرزبان)
- [ربات تلگرام](#ربات-تلگرام)
- [رابط خط فرمان (CLI) مرزبان](#رابط-خط-فرمان-cli-مرزبان)
- [ارسال اعلان‌ها به آدرس وبهوک](#ارسال-اعلانها-به-آدرس-وبهوک)
- [کمک مالی](#کمک-مالی)
- [لایسنس](#لایسنس)
- [مشارکت در توسعه](#مشارکت-در-توسعه)

# بررسی اجمالی

NeonGate یک پنل مدیریت پروکسی است که بر اساس Marzban ساخته شده و امکان مدیریت چند صد حساب پروکسی را فراهم میکند. NeonGate از [Xray-core](https://github.com/XTLS/Xray-core) قدرت گرفته و با Python و React پیاده سازی شده است.

## چرا مرزبان؟

مرزبان دارای یک رابط کاربری ساده است که قابلیت های زیادی دارد. مرزبان امکان ایجاد چند نوع پروکسی برای کاربر ها را فراهم میکند بدون اینکه به تنظیمات پیچیده ای نیاز داشته باشید. به کمک رابط کاربری تحت وب مرزبان، شما میتوانید کاربران را مانیتور، ویرایش و در صورت نیاز، محدود کنید.

### امکانات

- **رابط کاربری تحت وب** آماده
- به صورت **REST API** پیاده سازی شده
- پشتیبانی از پروتکل های **Vmess**, **VLESS**, **Trojan** و **Shadowsocks**
- امکان فعالسازی **چندین پروتکل** برای هر یوزر
- امکان ساخت **چندین کاربر** بر روی یک inbound
- پشتیبانی از **چندین inbound** بر روی **یک port** (به کمک fallbacks)
- محدودیت بر اساس مصرف **ترافیک** و **تاریخ انقضا**
- محدودیت **ترافیک دوره ای** (به عنوان مثال روزانه، هفتگی و غیره)
- پشتیبانی از **Subscription link** سازگار با **V2ray** _(مثل نرم افزار های V2RayNG, SingBox, Nekoray و...)_ و **Clash**
- ساخت **لینک اشتراک گذاری** و **QRcode** به صورت خودکار
- مانیتورینگ منابع سرور و **مصرف ترافیک**
- پشتیبانی از تنظیمات xray
- پشتیبانی از **TLS**
- **ربات تلگرام**
- **رابط خط فرمان (CLI)** داخلی
- قابلیت ایجاد **چندین مدیر** (تکمیل نشده است)

# راهنمای نصب

با دستور زیر مرزبان را با دیتابیس SQLite نصب کنید:

```bash
sudo bash -c "$(curl -sL https://github.com/Gozargah/Marzban-scripts/raw/master/marzban.sh)" @ install
```

با دستور زیر مرزبان را با دیتابیس MySQL نصب کنید:

```bash
sudo bash -c "$(curl -sL https://github.com/Gozargah/Marzban-scripts/raw/master/marzban.sh)" @ install --database mysql
```

با دستور زیر مرزبان را با دیتابیس MariaDB نصب کنید:

```bash
sudo bash -c "$(curl -sL https://github.com/Gozargah/Marzban-scripts/raw/master/marzban.sh)" @ install --database mariadb
```

وقتی نصب تمام شد:

- شما لاگ های مرزبان رو مشاهده میکنید که می‌توانید با بستن ترمینال یا فشار دادن `Ctrl+C` از آن خارج شوید
- فایل های مرزبان در پوشه `/opt/marzban` قرار می‌گیرند
- فایل تنظیمات در مسیر `/opt/marzban/.env` قرار می‌گیرد ([تنظیمات](#تنظیمات) را مشاهده کنید)
- فایل های مهم (اطلاعات) مرزبان در مسیر `/usr/lib/marzban` قرار می‌گیرند
  به دلایل امنیتی، داشبورد مرزبان از طریق آیپی قابل دسترسی نیست. بنابراین، باید برای دامنه خود [گواهی SSL](https://gozargah.github.io/marzban/fa/examples/issue-ssl-certificate) بگیرید و از طریق آدرس https://YOUR_DOMAIN:8000/dashboard/ وارد داشبورد مرزبان شوید (نام دامنه خود را جایگزین YOUR_DOMAIN کنید)
- همچنین می‌توانید از فوروارد کردن پورت SSH برای دسترسی لوکال به داشبورد مرزبان بدون دامنه استفاده کنید. نام کاربری و آیپی سرور خود را جایگزین `user@serverip` کنید و دستور زیر را اجرا کنید:

```bash
ssh -L 8000:localhost:8000 user@serverip
```

در نهایت، می‌توانید لینک زیر را در مرورگر خود وارد کنید تا به داشبورد مرزبان دسترسی پیدا کنید:

http://localhost:8000/dashboard/

به محض بستن ترمینال SSH، دسترسی شما به داشبورد قطع خواهد شد. بنابراین، این روش تنها برای تست کردن توصیه می‌شود.

در مرحله بعد, باید یک ادمین سودو بسازید

```bash
marzban cli admin create --sudo
```

تمام! حالا با این اطلاعات می‌توانید وارد مرزبان شوید

برای مشاهده راهنمای اسکریپت مرزبان دستور زیر را اجرا کنید

```bash
marzban --help
```

اگر مشتاق هستید که مرزبان رو با پایتون و به صورت دستی اجرا کنید، مراحل زیر را مشاهده کنید

<details markdown="1">
<summary><h3>نصب به صورت دستی (پیچیده)</h3></summary>

لطفا xray را نصب کنید.
شما میتواند به کمک [Xray-install](https://github.com/XTLS/Xray-install) این کار را انجام دهید.

```bash
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
```

پروژه را clone کنید و dependency ها را نصب کنید. دقت کنید که نسخه پایتون شما Python>=3.12.7 باشد.

```bash
git clone https://github.com/Gozargah/Marzban.git
cd Marzban
wget -qO- https://bootstrap.pypa.io/get-pip.py | python3 -
python3 -m pip install -r requirements.txt
```

همچنین میتواند از , [Python Virtualenv](https://pypi.org/project/virtualenv/) هم استفاده کنید.

سپس کامند زیر را اجرا کنید تا دیتابیس تنظیم شود.

```bash
alembic upgrade head
```

اگر می خواهید از `marzban-cli` استفاده کنید، باید آن را به یک فایل در `$PATH` خود لینک و قابل اجرا (executable) کنید. سپس تکمیل خودکار (auto-completion) آن را نصب کنید:

```bash
sudo ln -s $(pwd)/marzban-cli.py /usr/bin/marzban-cli
sudo chmod +x /usr/bin/marzban-cli
marzban-cli completion install
```

حالا یک کپی از `.env.example` با نام `.env` بسازید و با یک ادیتور آن را باز کنید و تنظیمات دلخواه خود را انجام دهید. یه عنوان مثال نام کاربری و رمز عبور را می توانید در این فایل تغییر دهید.

```bash
cp .env.example .env
nano .env
```

> برای اطلاعات بیشتر بخش [تنظیمات](#تنظیمات) را مطالعه کنید.

در انتها, مرزبان را به کمک دستور زیر اجرا کنید.

```bash
python3 main.py
```

اجرا با استفاده از systemctl در لینوکس

```
systemctl enable /var/lib/marzban/marzban.service
systemctl start marzban
```

اجرا با nginx

```
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name  example.com;

    ssl_certificate      /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key  /etc/letsencrypt/live/example.com/privkey.pem;

    location ~* /(dashboard|statics|sub|api|docs|redoc|openapi.json) {
        proxy_pass http://0.0.0.0:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

or

```
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name  marzban.example.com;

    ssl_certificate      /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key  /etc/letsencrypt/live/example.com/privkey.pem;

    location / {
        proxy_pass http://0.0.0.0:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

به صورت پیشفرض مرزبان در آدرس `http://localhost:8000/dashboard` اجرا میشود. شما میتوانید با تغییر `UVICORN_HOST` و `UVICORN_PORT`، هاست و پورت را تغییر دهید.

</details>

# تنظیمات

> متغیر های زیر در فایل ‍`env` یا `.env` استفاده میشوند. شما می توانید با تعریف و تغییر آن ها، تنظیمات مرزبان را تغییر دهید.

|                                                                                                                                                  توضیحات |                  متغیر                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------: | :--------------------------------------: |
|                                                                                                                                       نام کاربری مدیر کل |              SUDO_USERNAME               |
|                                                                                                                                         رمز عبور مدیر کل |              SUDO_PASSWORD               |
|                                           آدرس دیتابیس ([بر اساس مستندات SQLAlchemy](https://docs.sqlalchemy.org/en/20/core/engines.html#database-urls)) |         SQLALCHEMY_DATABASE_URL          |
|                                                                                               آدرس هاستی که مرزبان روی آن اجرا میشود (پیشفرض: `0.0.0.0`) |               UVICORN_HOST               |
|                                                                                                       پورتی که مرزبان روی آن اجرا میشود (پیشفرض: `8000`) |               UVICORN_PORT               |
|                                                                                                                اجرای مرزبان بر روی یک Unix domain socket |               UVICORN_UDS                |
|                                                                                                               آدرس گواهی SSL به جهت ایمن کردن پنل مرزبان |           UVICORN_SSL_CERTFILE           |
|                                                                                                                                      آدرس کلید گواهی SSL |           UVICORN_SSL_KEYFILE            |
|                                                          نوع گواهینامه مرجع SSL. از «خصوصی» برای آزمایش CA با امضای خود استفاده کنید (پیش‌فرض: `public`) |           UVICORN_SSL_CA_TYPE            |
|                                                                                                 مسیر فایل json تنظیمات xray (پیشفرض: `xray_config.json`) |                XRAY_JSON                 |
|                                                                                                         مسیر باینری xray (پیشفرض: `/usr/local/bin/xray`) |           XRAY_EXECUTABLE_PATH           |
|                                                                                                    مسیر asset های xray (پیشفرض: `/usr/local/share/xray`) |             XRAY_ASSETS_PATH             |
|                                  پیشوند (یا هاست) آدرس های اشتراکی (زمانی کاربرد دارد که نیاز دارید دامنه subscription link ها با دامنه پنل متفاوت باشد) |       XRAY_SUBSCRIPTION_URL_PREFIX       |
|                                                                                                         تگ inboundای که به عنوان fallback استفاده میشود. |        XRAY_FALLBACKS_INBOUND_TAG        |
|                                                                                 تگ های inbound ای که لازم نیست در کانفیگ های ساخته شده وجود داشته باشند. |        XRAY_EXCLUDE_INBOUND_TAGS         |
|                                                                                                                آدرس محل template های شخصی سازی شده کاربر |        CUSTOM_TEMPLATES_DIRECTORY        |
|                                                                            تمپلیت مورد استفاده برای تولید کانفیگ های Clash (پیشفرض: `clash/default.yml`) |       CLASH_SUBSCRIPTION_TEMPLATE        |
|                                                                                      تمپلیت صفحه اطلاعات اشتراک کاربر (پیشفرض `subscription/index.html`) |        SUBSCRIPTION_PAGE_TEMPLATE        |
|                                                                                                              تمپلیت صفحه اول (پیشفرض: `home/index.html`) |            HOME_PAGE_TEMPLATE            |
|                                                                                        توکن ربات تلگرام (دریافت از [@botfather](https://t.me/botfather)) |            TELEGRAM_API_TOKEN            |
|                                                                           آیدی عددی ادمین در تلگرام (دریافت از [@userinfobot](https://t.me/userinfobot)) |            TELEGRAM_ADMIN_ID             |
|                                                                                                                                اجرای ربات از طریق پروکسی |            TELEGRAM_PROXY_URL            |
|                                                             مدت زمان انقضا توکن دسترسی به پنل مرزبان, `0` به معنای بدون تاریخ انقضا است (پیشفرض: `1440`) |     JWT_ACCESS_TOKEN_EXPIRE_MINUTES      |
|                                                                                        فعال سازی داکیومنتیشن به آدرس `/docs` و `/redoc`(پیشفرض: `False`) |                   DOCS                   |
|                                                                                                      فعالسازی حالت توسعه (development) (پیشفرض: `False`) |                  DEBUG                   |
|                                  آدرس webhook که تغییرات حالت یک کاربر به آن ارسال می‌شوند. اگر این متغیر مقدار داشته باشد، ارسال پیام‌ها انجام می‌شوند. |             WEBHOOK_ADDRESS              |
|                                                                           متغیری که به عنوان `x-webhook-secret` در header ارسال می‌شود. (پیشفرض: `None`) |              WEBHOOK_SECRET              |
|                                                              تعداد دفعاتی که برای ارسال یک پیام، در صورت تشخیص خطا در ارسال تلاش دوباره شود (پیشفرض `3`) |    NUMBER_OF_RECURRENT_NOTIFICATIONS     |
|                                                                    مدت زمان بین هر ارسال دوباره پیام در صورت تشخیص خطا در ارسال به ثانیه (پیشفرض: `180`) |     RECURRENT_NOTIFICATIONS_TIMEOUT      |
|                                                                     هنگام رسیدن مصرف کاربر به چه درصدی پیام اخطار به آدرس وبهوک ارسال شود (پیشفرض: `80`) |       NOTIFY_REACHED_USAGE_PERCENT       |
|                                                                           چند روز مانده به انتهای سرویس پیام اخطار به آدرس وبهوک ارسال شود (پیشفرض: `3`) |             NOTIFY_DAYS_LEFT             |
| حذف خودکار کاربران منقضی شده (و بطور اختیاری محدود شده) پس از گذشت این تعداد روز (مقادیر منفی این قابلیت را به طور پیشفرض غیرفعال می کنند. پیشفرض: `-1`) |          USERS_AUTODELETE_DAYS           |
|                                                                                                 تعیین اینکه کاربران محدودشده شامل حذف خودکار بشوند یا نه | USER_AUTODELETE_INCLUDE_LIMITED_ACCOUNTS |
|                                                           فعال کردن کانفیگ سفارشی JSON برای همه برنامه‌هایی که از آن پشتیبانی می‌کنند (پیش‌فرض: `False`) |         USE_CUSTOM_JSON_DEFAULT          |
|                                                                                فعال کردن کانفیگ سفارشی JSON فقط برای برنامه‌ی V2rayNG (پیش‌فرض: `False`) |       USE_CUSTOM_JSON_FOR_V2RAYNG        |
|                                                                              فعال کردن کانفیگ سفارشی JSON فقط برای برنامه‌ی Streisand (پیش‌فرض: `False`) |      USE_CUSTOM_JSON_FOR_STREISAND       |
|                                                                                 فعال کردن کانفیگ سفارشی JSON فقط برای برنامه‌ی V2rayN (پیش‌فرض: `False`) |        USE_CUSTOM_JSON_FOR_V2RAYN        |

# داکیومنت

[داکیومنت مرزبان](https://gozargah.github.io/marzban) تمامی آموزش‌های ضروری برای شروع را فراهم می‌کند و در سه زبان فارسی، انگلیسی و روسی در دسترس است. این داکیومنت نیاز به تلاش زیادی دارد تا تمامی جنبه‌های پروژه را به طور کامل پوشش دهد. ما از کمک و همکاری شما برای بهبود آن استقبال و قدردانی می‌کنیم. می‌توانید در این صفحه [گیت‌هاب](https://github.com/Gozargah/gozargah.github.io) مشارکت کنید.

# استفاده از API

مرزبان به توسعه دهندگانAPI REST ارائه می دهد. برای مشاهده اسناد API در قالب Swagger UI یا ReDoc، متغیر `DOCS=True` را در تنظیمات خود ست کنید و در مرورگر به مسیر `/docs` و `/redoc` بروید.

# پشتیبان گیری از مرزبان

بهتر است همیشه از فایل های مرزبان خود نسخه پشتیبان تهیه کنید تا در صورت خرابی سیستم یا حذف تصادفی اطلاعات از دست نروند. مراحل تهیه نسخه پشتیبان از مرزبان به شرح زیر است:

1. به طور پیش فرض، تمام فایل های مهم مرزبان در `/var/lib/marzban` ذخیره می شوند (در نسخه داکر). کل پوشه `/var/lib/marzban` را در یک مکان پشتیبان مورد نظر خود، مانند هارد دیسک خارجی یا فضای ذخیره سازی ابری کپی کنید.
2. علاوه بر این، مطمئن شوید که از فایل env خود که حاوی متغیرهای تنظیمات شما است و همچنین فایل پیکربندی Xray خود نسخه پشتیبان تهیه کنید.

خدمات پشتیبان‌گیری مرزبان به طور کارآمد تمام فایل‌های ضروری را فشرده کرده و آن‌ها را به ربات تلگرام مشخص شده شما ارسال می‌کند. این خدمات از پایگاه‌های داده SQLite، MySQL و MariaDB پشتیبانی می‌کند. یکی از ویژگی‌های اصلی آن، خودکار بودن است که به شما اجازه می‌دهد تا پشتیبان‌گیری‌ها را هر ساعت برنامه‌ریزی کنید. محدودیتی در مورد محدودیت‌های آپلود تلگرام برای ربات‌ها وجود ندارد؛ اگر فایل شما بزرگتر از میزان محدودیت تلگرام باشد، به دو یا چند بخش تقسیم شده و ارسال می‌شود. علاوه بر این، شما می‌توانید در هر زمان پشتیبان‌گیری فوری انجام دهید.

نصب آخرین ورژن مرزبان کامند:

```bash
sudo bash -c "$(curl -sL https://github.com/Gozargah/Marzban-scripts/raw/master/marzban.sh)" @ install-script
```

راه‌اندازی سرویس پشتیبان گیری:

```bash
marzban backup-service
```

پشتیبان گیری فوری:

```bash
marzban backup
```

با انجام این مراحل، می توانید اطمینان حاصل کنید که از تمام فایل ها و داده های مرزبان خود یک نسخه پشتیبان تهیه کرده اید. به خاطر داشته باشید که نسخه های پشتیبان خود را به طور مرتب به روز کنید تا آنها را به روز نگه دارید.

# ربات تلگرام

مرزبان دارای یک ربات تلگرام داخلی است که می تواند مدیریت سرور، ایجاد و حذف کاربر و ارسال نوتیفیکیشن را انجام دهد. این ربات را می توان با انجام چند مرحله ساده به راحتی فعال کرد

برای فعال کردن ربات تلگرام:

1. در تنظیمات، متغیر`TELEGRAM_API_TOKEN` را به API TOKEN ربات تلگرام خود تنظیم کنید.
2. همینطور، متغیر`TELEGRAM_ADMIN_ID` را به شناسه عددی حساب تلگرام خود تنظیم کنید. شما می‌توانید شناسه خود را از [@userinfobot](https://t.me/userinfobot) دریافت کنید.

# رابط خط فرمان (CLI) مرزبان

مرزبان دارای یک رابط خط فرمان (Command Line Interface / CLI) داخلی است که به مدیران اجازه می دهد با مرزبان ارتباط مستقیم داشته باشند.

اگر از Docker برای مرزبان استفاده می کنید، بهتر است از دستور های `docker exec` یا `docker-compose exec` استفاده کنید تا به پوسته (shell) تعاملی کانتینر مرزبان دسترسی پیدا کنید.

برای مثال، به پوشه ی `docker-compose.yml` مرزبان بروید و دستور زیر را اجرا کنید:

```bash
$ sudo docker-compose exec -it marzban bash
```

رابط خط فرمان (CLI) مرزبان از طریق دستور `marzban-cli` هرکجا در دسترس خواهد بود!

برای کسب اطلاعات بیشتر می توانید [مستندات CLI مرزبان](./cli/README.md) را مطالعه کنید.

# ارسال اعلان‌ها به آدرس وبهوک

شما می‌توانید آدرسی را برای مرزبان فراهم کنید تا تغییرات کاربران را به صورت اعلان برای شما ارسال کند.

اعلان‌ها به صورت یک درخواست POST به آدرسی که در `WEBHOOK_ADDRESS` فراهم شده به همراه مقدار تعیین شده در `WEBHOOK_SECRET` به عنوان `x-webhook-secret` در header درخواست ارسال می‌شوند.

نمونه‌ای از درخواست ارسال شده توسط مرزبان:

```
Headers:
Host: 0.0.0.0:9000
User-Agent: python-requests/2.28.1
Accept-Encoding: gzip, deflate
Accept: */*
Connection: keep-alive
x-webhook-secret: something-very-very-secret
Content-Length: 107
Content-Type: application/json



Body:
{"username": "marzban_test_user", "action": "user_updated", "enqueued_at": 1680506457.636369, "tries": 0}
```

انواع مختلف actionهایی که مرزبان ارسال می‌کند: `user_created`, `user_updated`, `user_deleted`, `user_limited`, `user_expired`, `user_disabled`, `user_enabled`

# کمک مالی

اگر مرزبان را برای شما مفید بوده و می‌خواهید از توسعه آن حمایت کنید، می‌توانید در یکی از طریق یکی از شبکه های کریپتو زیر کمک مالی کنید:

- شبکه TRON (TRX): `TX8kJoDcowQPBFTYHAJR36GyoUKP1Xwzkb`
- شبکه ETH، BNB، MATIC: `0xFdc9ad32454FA4fc4733270FCc12ddBFb68b83F7`
- شبکه بیت کوین: `bc1qpys2nefgsjjgae3g3gqy9crsv3h3rm96tlkz0v`
- شبکه Dogecoin: `DJAocBAu8y6LwhDKUktLAyzV8xyoFeHH6R`
- شبکه TON: `EQAVf-7hAXHlF-jmrKE44oBwN7HGQFVBLAtrOsev5K4qR4P8`

از حمایت شما متشکرم!

# لایسنس

توسعه یافته شده در [ناشناس!] و منتشر شده تحت لایسنس [AGPL-3.0](./LICENSE).

# مشارکت در توسعه

این ❤️‍🔥 تقدیم به همه‌ی کسایی که در توسعه مرزبان مشارکت می‌کنند! اگر می‌خواهید مشارکت داشته باشید، لطفاً [دستورالعمل‌های مشارکت](CONTRIBUTING.md) ما را بررسی کنید و در صورت تمایل Pull Request ارسال کنید یا یک Issue باز کنید. همچنین از شما برای پیوستن به گروه [تلگرام](https://t.me/gozargah_marzban) ما برای حمایت یا کمک به راهنمایی استقبال می کنیم.

لطفا اگر امکانش رو دارید، با بررسی [لیست کار ها](https://github.com/gozargah/marzban/issues) به ما در بهبود مرزبان کمک کنید. کمک های شما با آغوش باز پذیرفته میشه.

<p align="center">
با تشکر از همه همکارانی که به بهبود مرزبان کمک کردند:
</p>
<p align="center">
<a href="https://github.com/Gozargah/Marzban/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Gozargah/Marzban" />
</a>
</p>
<p align="center">
  ساخته شده با <a rel="noopener noreferrer" target="_blank" href="https://contrib.rocks">contrib.rocks</a>
</p>
