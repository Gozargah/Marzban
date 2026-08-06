import smtplib
import socket
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

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


def _build_subscription_email_body(username: str, subscription_url: str) -> tuple[str, str]:
    text = f"Hi {username},\n\nHere is your subscription link:\n{subscription_url}\n"
    html = (
        f"<p>Hi {username},</p>"
        f"<p>Here is your subscription link:</p>"
        f'<p><a href="{subscription_url}">{subscription_url}</a></p>'
    )
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
    subject: str = "Your subscription",
) -> None:
    text, html = _build_subscription_email_body(username, subscription_url)

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = from_email
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
    subject: str = "Your subscription",
) -> None:
    """Sends over Resend's HTTP API (https://resend.com) instead of SMTP --
    useful when the host's outbound SMTP ports (587/465) are blocked, since
    this goes out over plain HTTPS (443) instead."""
    text, html = _build_subscription_email_body(username, subscription_url)

    try:
        resp = requests.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "from": from_email,
                "to": [to_email],
                "subject": subject,
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
