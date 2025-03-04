import base64
import binascii

from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import x25519
from OpenSSL import crypto


def get_cert_SANs(cert: bytes):
    cert = x509.load_pem_x509_certificate(cert, default_backend())
    san_list = []
    for extension in cert.extensions:
        if isinstance(extension.value, x509.SubjectAlternativeName):
            san = extension.value
            for name in san:
                san_list.append(name.value)
    return san_list


def generate_certificate():
    k = crypto.PKey()
    k.generate_key(crypto.TYPE_RSA, 4096)
    cert = crypto.X509()
    cert.get_subject().CN = "Gozargah"
    cert.gmtime_adj_notBefore(0)
    cert.gmtime_adj_notAfter(100*365*24*60*60)
    cert.set_issuer(cert.get_subject())
    cert.set_pubkey(k)
    cert.sign(k, 'sha512')
    cert_pem = crypto.dump_certificate(
        crypto.FILETYPE_PEM, cert).decode("utf-8")
    key_pem = crypto.dump_privatekey(crypto.FILETYPE_PEM, k).decode("utf-8")

    return {
        "cert": cert_pem,
        "key": key_pem
    }


def add_base64_padding(b64_string: str) -> str:
    """Adds missing Base64 padding if necessary."""
    missing_padding = len(b64_string) % 4
    return b64_string + ('=' * (4 - missing_padding)) if missing_padding else b64_string


def get_x25519_public_key(private_key_b64: str) -> str:
    """
    Converts an X25519 private key (URL-safe Base64) into a public key (URL-safe Base64 format).

    :param private_key_b64: The private key in URL-safe Base64 format (without padding).
    :return: The corresponding public key as a URL-safe Base64 string (without padding).
    """
    try:
        # Decode Base64 (URL-safe) Add padding if needed
        private_key_bytes = base64.urlsafe_b64decode(
            add_base64_padding(private_key_b64))

        # Ensure the private key is 32 bytes
        if len(private_key_bytes) != 32:
            raise ValueError(
                "Invalid private key length. Must be 32 bytes after decoding.")

        # Load the private key
        private_key = x25519.X25519PrivateKey.from_private_bytes(
            private_key_bytes)

        # Derive the public key
        public_key = private_key.public_key()

        # Convert the public key to bytes
        public_key_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )

        # Encode the public key as URL-safe Base64 (without padding)
        public_key_b64 = base64.urlsafe_b64encode(
            public_key_bytes).decode().rstrip("=")

        return public_key_b64

    except (ValueError, binascii.Error):
        raise ValueError("Invalid private key.")
