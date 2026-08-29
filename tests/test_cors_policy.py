from app.utils.cors import DEV_ORIGINS, cors_policy


class TestDefault:
    def test_no_origins_disables_cors(self):
        policy = cors_policy([])

        assert policy.enabled is False
        assert policy.origins == []
        assert policy.warning is None

    def test_blank_entries_are_dropped(self):
        policy = cors_policy(["", "  "])

        assert policy.origins == []
        assert policy.enabled is False


class TestExplicitOrigins:
    def test_listed_origins_allow_credentials(self):
        policy = cors_policy(["https://panel.example"])

        assert policy.enabled is True
        assert policy.origins == ["https://panel.example"]
        assert policy.allow_credentials is True
        assert policy.warning is None

    def test_several_origins_are_kept(self):
        policy = cors_policy(["https://a.example", "https://b.example"])

        assert policy.origins == ["https://a.example", "https://b.example"]


class TestWildcard:
    def test_wildcard_turns_credentials_off(self):
        policy = cors_policy(["*"])

        assert policy.origins == ["*"]
        assert policy.allow_credentials is False

    def test_wildcard_warns(self):
        assert "ALLOWED_ORIGINS" in cors_policy(["*"]).warning

    def test_wildcard_wins_over_listed_origins(self):
        policy = cors_policy(["https://panel.example", "*"])

        assert policy.origins == ["*"]
        assert policy.allow_credentials is False


class TestDebug:
    def test_dev_server_origins_are_added(self):
        policy = cors_policy([], debug=True)

        assert policy.origins == DEV_ORIGINS
        assert policy.allow_credentials is True

    def test_configured_origins_are_kept_alongside(self):
        policy = cors_policy(["https://panel.example"], debug=True)

        assert policy.origins[0] == "https://panel.example"
        assert set(DEV_ORIGINS).issubset(policy.origins)

    def test_no_duplicates(self):
        policy = cors_policy([DEV_ORIGINS[0]], debug=True)

        assert policy.origins.count(DEV_ORIGINS[0]) == 1
