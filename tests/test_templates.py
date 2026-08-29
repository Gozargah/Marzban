"""How the Jinja environment escapes what it renders.

The same environment renders the subscription page and the client configs, and
the two want opposite things: the page has to escape a link, while the clash
YAML and the sing-box/v2ray JSON would be corrupted by escaping. Links are
built from host remarks and addresses, which an admin types by hand, so a stray
quote in one of them lands here rather than in a browser's parser.
"""

import json
from types import SimpleNamespace

import pytest
import yaml

from app.templates import env, render_template
from app.models.user import UserDataLimitResetStrategy, UserStatus

HOSTILE_LINK = 'vless://id@example.com?sni="><script>alert(1)</script>#it\'s mine'


def page(links) -> str:
    user = SimpleNamespace(
        username="alice",
        status=UserStatus.active,
        data_limit=None,
        used_traffic=0,
        data_limit_reset_strategy=UserDataLimitResetStrategy.no_reset,
        expire=None,
        links=links,
    )
    return render_template("subscription/index.html", {"user": user})


class TestSubscriptionPage:
    def test_a_link_is_escaped(self):
        rendered = page([HOSTILE_LINK])

        assert "<script>alert(1)</script>" not in rendered
        assert "&lt;script&gt;" in rendered

    def test_a_quote_cannot_close_the_attribute_it_sits_in(self):
        rendered = page([HOSTILE_LINK])

        for line in rendered.splitlines():
            if "data-link=" in line or "<input type=\"text\"" in line:
                assert '"><script' not in line

    def test_the_copy_button_carries_the_link_as_data(self):
        """Not as an argument in an onclick: escaping does not protect that."""
        rendered = page([HOSTILE_LINK])

        assert "onclick=\"copyLink(" not in rendered
        assert rendered.count('class="copy-button" data-link=') == 1


class TestClientConfigTemplates:
    """These are not HTML, and escaping them would break the config.

    Only the ones that need no context are rendered here; the rest are covered
    by test_subscription_links.py, which parses what a client would receive.
    """

    @pytest.mark.parametrize(
        "template", ["v2ray/default.json", "singbox/default.json", "mux/default.json"]
    )
    def test_json_templates_render_as_json(self, template):
        json.loads(render_template(template))

    def test_the_clash_settings_render_as_yaml(self):
        yaml.safe_load(render_template("clash/settings.yml"))

    @pytest.mark.parametrize(
        "template, escaped",
        [
            ("subscription/index.html", True),
            ("home/index.html", True),
            ("clash/default.yml", False),
            ("v2ray/default.json", False),
        ],
    )
    def test_only_markup_is_escaped(self, template, escaped):
        assert env.autoescape(template) is escaped
