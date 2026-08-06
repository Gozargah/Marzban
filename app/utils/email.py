import html as html_module
import smtplib
import socket
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Optional

import requests

RESEND_API_URL = "https://api.resend.com/emails"


class EmailSendError(Exception):
    pass


def _connect_ipv4(server: smtplib.SMTP, host: str, port: int) -> None:
    """Connects using the host's first IPv4 address specifically.

    Plain smtplib.SMTP(host, port) lets the OS resolver pick the address
    family, which on many VPS hosts returns an IPv6 address the host has no
    real route for -- connect() then fails immediately with
    "[Errno 101] Network is unreachable" even though IPv4 works fine.
    Connecting to the resolved IPv4 literal sidesteps that, while keeping
    server._host as the real hostname so starttls() still validates the
    certificate against the right name.
    """
    ipv4_address = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)[0][4][0]
    server.connect(ipv4_address, port)
    server._host = host


_CONNECT_STEPS = [
    "Скачайте приложение Happ -- happ.su, App Store или Google Play.",
    "Скопируйте ссылку на подписку (кнопка выше или ссылка ниже).",
    "Откройте Happ и нажмите на значок ⋮ (три точки) в правом верхнем углу.",
    "Выберите «Добавить из буфера обмена».",
    "Нажмите на появившийся профиль, затем на большую кнопку питания по центру экрана -- готово, VPN подключён.",
]


def _build_subscription_email_body(
    username: str,
    subscription_url: str,
    brand_name: str,
    rules_text: Optional[str] = None,
) -> tuple[str, str]:
    text_lines = [
        f"Здравствуйте, {username}!",
        "",
        f"Ваша ссылка на подписку {brand_name}:",
        subscription_url,
        "",
        "Как подключиться:",
    ]
    text_lines += [f"{i}. {step}" for i, step in enumerate(_CONNECT_STEPS, 1)]
    if rules_text:
        text_lines += ["", "Правила использования:", rules_text]
    text = "\n".join(text_lines) + "\n"

    safe_username = html_module.escape(username)
    safe_brand = html_module.escape(brand_name)
    safe_url = html_module.escape(subscription_url)

    steps_html = "".join(
        f'<li style="margin:0 0 10px;padding-left:4px;">{html_module.escape(step)}</li>'
        for step in _CONNECT_STEPS
    )

    rules_html = ""
    if rules_text:
        safe_rules = html_module.escape(rules_text).replace("\n", "<br>")
        rules_html = f"""
        <tr>
          <td style="padding:0 32px 28px;">
            <div style="background:#f4f6fb;border-radius:10px;padding:18px 20px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#4b5563;text-transform:uppercase;letter-spacing:.04em;">Правила использования</p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">{safe_rules}</p>
            </div>
          </td>
        </tr>"""

    html = f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.06);max-width:480px;">
        <tr>
          <td style="background:#4f46e5;padding:28px 32px;" align="center">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">{safe_brand}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px;" align="center">
            <p style="margin:0 0 12px;font-size:16px;color:#111827;">Здравствуйте, {safe_username}!</p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">Ваша ссылка на подписку {safe_brand} готова. Нажмите на кнопку ниже, чтобы открыть её в приложении.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px;" align="center">
            <a href="{safe_url}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">Открыть подписку</a>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px;" align="center">
            <p style="margin:0;font-size:12px;color:#9ca3af;word-break:break-all;">Или скопируйте ссылку вручную:<br><a href="{safe_url}" style="color:#6366f1;">{safe_url}</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px;">
            <div style="background:#f4f6fb;border-radius:10px;padding:18px 20px;">
              <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#4b5563;text-transform:uppercase;letter-spacing:.04em;">Как подключиться</p>
              <ol style="margin:0;padding:0 0 0 18px;font-size:14px;line-height:1.5;color:#374151;">{steps_html}</ol>
            </div>
          </td>
        </tr>{rules_html}
        <tr>
          <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #eef0f3;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">Это письмо отправлено автоматически, отвечать на него не нужно. Если у вас возникли вопросы — свяжитесь с администратором {safe_brand}.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>"""
    return text, html


def send_subscription_email(
    to_email: str,
    username: str,
    subscription_url: str,
    smtp_host: str,
    smtp_port: int,
    smtp_username: str,
    smtp_password: str,
    from_email: str,
    brand_name: str = "Marzban",
    from_name: Optional[str] = None,
    rules_text: Optional[str] = None,
    subject: Optional[str] = None,
) -> None:
    text, html = _build_subscription_email_body(username, subscription_url, brand_name, rules_text)

    message = MIMEMultipart("alternative")
    message["Subject"] = subject or f"Ваша подписка — {brand_name}"
    message["From"] = formataddr((from_name, from_email)) if from_name else from_email
    message["To"] = to_email
    message.attach(MIMEText(text, "plain"))
    message.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(timeout=10) as server:
            _connect_ipv4(server, smtp_host, smtp_port)
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.sendmail(from_email, to_email, message.as_string())
    except Exception as e:
        raise EmailSendError(str(e)) from e


def send_subscription_email_via_resend(
    to_email: str,
    username: str,
    subscription_url: str,
    api_key: str,
    from_email: str,
    brand_name: str = "Marzban",
    from_name: Optional[str] = None,
    rules_text: Optional[str] = None,
    subject: Optional[str] = None,
) -> None:
    """Sends over Resend's HTTP API (https://resend.com) instead of SMTP --
    useful when the host's outbound SMTP ports (587/465) are blocked, since
    this goes out over plain HTTPS (443) instead."""
    text, html = _build_subscription_email_body(username, subscription_url, brand_name, rules_text)

    try:
        resp = requests.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "from": formataddr((from_name, from_email)) if from_name else from_email,
                "to": [to_email],
                "subject": subject or f"Ваша подписка — {brand_name}",
                "html": html,
                "text": text,
            },
            timeout=10,
        )
    except requests.RequestException as e:
        raise EmailSendError(f"Could not reach Resend: {e}") from e

    if resp.status_code >= 400:
        detail = resp.text[:300]
        try:
            detail = resp.json().get("message", detail)
        except ValueError:
            pass
        raise EmailSendError(f"Resend returned an error: {detail}")
