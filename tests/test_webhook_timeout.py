"""Both webhook senders must give up rather than hang.

Neither call used to pass a timeout. The Discord one runs on the thread that
served the request which triggered the report, and the notification one runs on
a scheduler thread, so in both cases an address that accepts the connection and
never answers holds that thread for as long as the kernel keeps the socket open.
"""

import pytest
import requests

from app.discord.handlers import report as discord_report
from app.jobs import send_notifications as notifications_job


class DummyResponse:
    ok = True
    status_code = 204

    def raise_for_status(self):
        return None


class TestDiscordWebhook:
    def test_the_post_carries_a_timeout(self, monkeypatch):
        calls = []

        def fake_post(url, **kwargs):
            calls.append(kwargs)
            return DummyResponse()

        monkeypatch.setattr(discord_report.requests, "post", fake_post)
        discord_report.send_webhook({"content": "hi"}, "https://discord.com/api/webhooks/x")

        assert calls, "the webhook was never sent"
        assert calls[0]["timeout"] == discord_report.DISCORD_WEBHOOK_TIMEOUT

    @pytest.mark.parametrize(
        "error",
        [requests.exceptions.Timeout("timed out"), requests.exceptions.ConnectionError("refused")],
    )
    def test_a_failed_delivery_is_logged_and_swallowed(self, monkeypatch, error):
        """Callers wrap this in `except Exception: pass`, so a raise would be silent."""
        logged = []

        def fake_post(url, **kwargs):
            raise error

        monkeypatch.setattr(discord_report.requests, "post", fake_post)
        monkeypatch.setattr(discord_report.logger, "error", lambda message: logged.append(message))

        discord_report.send_webhook({"content": "hi"}, "https://discord.com/api/webhooks/x")

        assert len(logged) == 1


class TestNotificationWebhook:
    def test_the_post_carries_a_timeout(self, monkeypatch):
        calls = []

        def fake_post(url, **kwargs):
            calls.append(kwargs)
            return DummyResponse()

        monkeypatch.setattr(notifications_job.session, "post", fake_post)
        assert notifications_job.send_req("http://127.0.0.1:9000/", [{"a": 1}]) is True

        assert calls[0]["timeout"] == notifications_job.WEBHOOK_REQUEST_TIMEOUT

    def test_a_timeout_counts_as_a_failed_delivery(self, monkeypatch):
        """False is what makes the job keep the notification for a later pass."""

        def fake_post(url, **kwargs):
            raise requests.exceptions.Timeout("timed out")

        monkeypatch.setattr(notifications_job.session, "post", fake_post)

        assert notifications_job.send_req("http://127.0.0.1:9000/", [{"a": 1}]) is False
