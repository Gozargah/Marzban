import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


class EmailSendError(Exception):
    pass


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
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.sendmail(from_email, to_email, message.as_string())
    except Exception as e:
        raise EmailSendError(str(e)) from e
