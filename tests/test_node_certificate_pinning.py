import ssl

import pytest
from OpenSSL import crypto

from app.xray.node import (
    CERTIFICATE_FETCH_TIMEOUT,
    NodeCertificateMismatch,
    ReSTXRayNode,
    certificate_fingerprint,
)


def make_certificate(common_name: str = "Gozargah"):
    """A throwaway self-signed certificate, standing in for a node's own."""
    key = crypto.PKey()
    key.generate_key(crypto.TYPE_RSA, 2048)
    cert = crypto.X509()
    cert.get_subject().CN = common_name
    cert.set_serial_number(1)
    cert.gmtime_adj_notBefore(0)
    cert.gmtime_adj_notAfter(3600)
    cert.set_issuer(cert.get_subject())
    cert.set_pubkey(key)
    cert.sign(key, "sha256")
    return (
        crypto.dump_certificate(crypto.FILETYPE_PEM, cert).decode(),
        crypto.dump_privatekey(crypto.FILETYPE_PEM, key).decode(),
    )


@pytest.fixture(scope="module")
def client_identity():
    return make_certificate("client")


@pytest.fixture(scope="module")
def node_cert():
    return make_certificate()[0]


@pytest.fixture(scope="module")
def other_node_cert():
    return make_certificate()[0]


@pytest.fixture
def node(client_identity, monkeypatch):
    """Build a node whose network calls are stubbed out."""
    cert, key = client_identity

    def build(server_cert=None):
        instance = ReSTXRayNode(
            address="203.0.113.10", port=62050, api_port=62051,
            ssl_key=key, ssl_cert=cert, server_cert=server_cert,
        )
        monkeypatch.setattr(
            type(instance), "make_request",
            lambda self, path, timeout, **kw: {"session_id": "stub"},
        )
        return instance

    return build


def present(monkeypatch, pem):
    """Stand in for the TLS handshake, recording how it was called."""
    calls = []

    def fetch(addr, timeout=None):
        calls.append({"addr": addr, "timeout": timeout})
        return pem

    monkeypatch.setattr(ssl, "get_server_certificate", fetch)
    return calls


class TestFingerprint:
    def test_is_stable_for_the_same_certificate(self, node_cert):
        assert certificate_fingerprint(node_cert) == certificate_fingerprint(node_cert)

    def test_differs_between_certificates(self, node_cert, other_node_cert):
        assert certificate_fingerprint(node_cert) != certificate_fingerprint(other_node_cert)


class TestPinning:
    def test_first_connection_pins_the_presented_certificate(self, node, node_cert, monkeypatch):
        instance = node()
        assert instance.server_cert is None

        present(monkeypatch, node_cert)
        instance.connect()

        assert instance.server_cert == node_cert

    def test_matching_certificate_is_accepted(self, node, node_cert, monkeypatch):
        instance = node(server_cert=node_cert)
        present(monkeypatch, node_cert)

        instance.connect()

        assert instance.server_cert == node_cert

    def test_a_different_certificate_is_refused(self, node, node_cert, other_node_cert, monkeypatch):
        instance = node(server_cert=node_cert)
        present(monkeypatch, other_node_cert)

        with pytest.raises(NodeCertificateMismatch):
            instance.connect()

    def test_the_fetch_cannot_hang_for_ever(self, node, node_cert, monkeypatch):
        """A node that accepts the connection and then says nothing would
        otherwise hold this thread for as long as the kernel allows."""
        calls = present(monkeypatch, node_cert)

        node().connect()

        assert calls[0]["timeout"] == CERTIFICATE_FETCH_TIMEOUT
        assert CERTIFICATE_FETCH_TIMEOUT > 0

    def test_the_pin_survives_a_refused_connection(self, node, node_cert, other_node_cert, monkeypatch):
        instance = node(server_cert=node_cert)
        present(monkeypatch, other_node_cert)

        with pytest.raises(NodeCertificateMismatch):
            instance.connect()

        assert instance.server_cert == node_cert


class TestTLSContext:
    def test_certificates_are_verified(self, node):
        assert node()._ssl_context.verify_mode == ssl.CERT_REQUIRED

    def test_hostname_checking_stays_off(self, node):
        # Node certificates carry a fixed CN, not the node's address.
        assert node()._ssl_context.check_hostname is False

    def test_a_known_certificate_is_used_as_the_trust_anchor(self, node, node_cert):
        instance = node(server_cert=node_cert)

        with open(instance.session.verify) as bundle:
            assert bundle.read() == node_cert


class TestLogStreamTrust:
    """The log stream's SSL context has to trust the pinned certificate, once.

    It is built in __init__ and reused for every reconnect, and the reconnect
    loop runs every two seconds for as long as somebody is watching. Loading
    the anchor there meant the same certificate was pushed into that context
    on every pass; it belongs where the certificate is pinned.
    """

    def node_anchors(self, instance):
        """How many times the node's own certificate sits in the context.

        Counted by common name rather than by the size of the trust store: the
        context starts out holding the system roots, which are not what these
        tests are about. `make_certificate` names a node's certificate after
        the subject a node really uses.
        """
        return [
            cert
            for cert in instance._ssl_context.get_ca_certs()
            for rdn in cert.get("subject", ())
            for field, value in rdn
            if field == "commonName" and value == "Gozargah"
        ]

    def test_a_certificate_pinned_up_front_is_trusted(self, node, node_cert):
        instance = node(server_cert=node_cert)

        assert len(self.node_anchors(instance)) == 1

    def test_a_certificate_pinned_on_first_use_is_trusted(self, node, node_cert, monkeypatch):
        instance = node()

        present(monkeypatch, node_cert)
        instance.connect()

        assert len(self.node_anchors(instance)) == 1

    def test_the_anchor_is_loaded_once_per_pin(self, node, node_cert, monkeypatch):
        """Connecting again must not pile the same anchor up behind it."""
        instance = node(server_cert=node_cert)

        present(monkeypatch, node_cert)
        instance.connect()
        instance.connect()

        assert len(self.node_anchors(instance)) == 1

    def test_the_stream_does_not_reload_the_anchor_per_attempt(self, node, node_cert, monkeypatch):
        """What the reconnect loop used to do on every pass."""
        instance = node(server_cert=node_cert)
        reloads = []
        monkeypatch.setattr(
            instance._ssl_context, "load_verify_locations",
            lambda *args, **kwargs: reloads.append(args),
        )

        connections = []
        monkeypatch.setattr(
            "app.xray.node.create_connection",
            lambda url, **kwargs: connections.append(url) or (_ for _ in ()).throw(OSError("no node")),
        )
        monkeypatch.setattr("app.xray.node.time.sleep", lambda seconds: instance._logs_queues.clear())

        instance._logs_queues.append([])
        instance._bg_fetch_logs()

        assert reloads == []


class TestLogStreamTrustStore:
    """The log stream must trust the pinned certificate and nothing else.

    Its context used to come from ssl.create_default_context(), which loads
    the system roots. Hostname checking is off here — a node's certificate
    does not carry its address — so those roots were not a second opinion but
    a hole: any certificate signed by any public CA would have been accepted
    for a node, and whoever could answer on the node's address could serve its
    logs. The pinned certificate is meant to be the whole of the check.
    """

    def test_nothing_is_trusted_before_a_certificate_is_pinned(self, node):
        assert node()._ssl_context.get_ca_certs() == []

    def test_the_pinned_certificate_is_the_only_anchor(self, node, node_cert):
        anchors = node(server_cert=node_cert)._ssl_context.get_ca_certs()

        assert len(anchors) == 1
        assert anchors[0]["subject"] == ((("commonName", "Gozargah"),),)

    def test_a_certificate_pinned_on_first_use_is_the_only_anchor(self, node, node_cert, monkeypatch):
        instance = node()
        present(monkeypatch, node_cert)

        instance.connect()

        assert len(instance._ssl_context.get_ca_certs()) == 1

    def test_the_system_roots_are_not_loaded(self, node, node_cert):
        """The bug in one assertion: a default context carries ~190 of these."""
        anchors = node(server_cert=node_cert)._ssl_context.get_ca_certs()
        issuers = {
            value
            for cert in anchors
            for rdn in cert.get("issuer", ())
            for field, value in rdn
            if field == "organizationName"
        }

        assert issuers == set()

    def test_verification_is_still_required(self, node, node_cert):
        """An empty trust store has to mean "refuses everything", not the
        other thing: turning verification off would make the store moot."""
        assert node(server_cert=node_cert)._ssl_context.verify_mode == ssl.CERT_REQUIRED

    def test_the_protocol_floor_is_not_lowered(self, node, node_cert):
        """Dropping create_default_context() must not cost anything else."""
        context = node(server_cert=node_cert)._ssl_context

        assert context.minimum_version >= ssl.TLSVersion.TLSv1_2
        assert context.options == ssl.create_default_context().options
