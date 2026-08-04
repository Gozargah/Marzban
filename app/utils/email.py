import smtplib
import socket
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


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
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = from_email
    message["To"] = to_email

    text = f"Hi {username},\n\nHere is your subscription link:\n{subscription_url}\n"
    html = (
        f"<p>Hi {username},</p>"
        f"<p>Here is your subscription link:</p>"
        f'<p><a href="{subscription_url}">{subscription_url}</a></p>'
    )
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
