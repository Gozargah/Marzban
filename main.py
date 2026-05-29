import click
import logging
import os
import ssl
import sys

import uvicorn
from cryptography import x509
from cryptography.hazmat.backends import default_backend

from app import app, logger
from app.utils.log_setup import configure_logging
from config import (DEBUG, LOG_FORMAT, UVICORN_HOST, UVICORN_PORT, UVICORN_SSL_CERTFILE,
                    UVICORN_SSL_KEYFILE, UVICORN_SSL_CA_TYPE, UVICORN_UDS)


def _enforce_single_worker():
    """Refuse to start under a multi-worker uvicorn configuration.

    APScheduler and the Xray subsystem keep in-process singletons
    (scheduler instance, XRayCore, XRayAPI, the `nodes` dict). Running
    multiple worker processes would silently duplicate every scheduled
    job and split node/user state across workers. See the comment at
    main.py:48-49 and docs/CODEBASE_MAP.md §6.12.

    Multi-worker support is a v1.0+ goal — see docs/V0.9.0_DECISIONS.md Q11.
    """
    env_workers = os.environ.get("UVICORN_WORKERS")
    cli_workers = None
    argv = sys.argv[1:]
    for i, arg in enumerate(argv):
        if arg == "--workers" and i + 1 < len(argv):
            cli_workers = argv[i + 1]
        elif arg.startswith("--workers="):
            cli_workers = arg.split("=", 1)[1]

    for source, raw in (("UVICORN_WORKERS env", env_workers), ("--workers CLI arg", cli_workers)):
        if raw is None or raw == "":
            continue
        try:
            n = int(raw)
        except ValueError:
            logger.error(
                f"{source} is not an integer ({raw!r}); refusing to start. "
                "Marzban only supports workers=1."
            )
            sys.exit(1)
        if n > 1:
            logger.error(
                f"Detected {source}={n}. Marzban only supports a single worker: "
                "APScheduler and the Xray subsystem hold in-process singletons "
                "(scheduler, XRayCore, XRayAPI, the live `nodes` map). Running "
                "multiple workers would duplicate scheduled jobs and split Xray "
                "state across processes. Unset UVICORN_WORKERS / drop --workers, "
                "or set it to 1. Multi-worker support is on the v1.0+ roadmap "
                "(see docs/V0.9.0_DECISIONS.md Q11)."
            )
            sys.exit(1)


def validate_cert_and_key(cert_file_path, key_file_path, ca_type):
    if ca_type == "private":
        logger.warning(f"""
{click.style('IMPORTANT!', blink=True, bold=True, fg="yellow")} 
You're running Marzban with: {click.style('UVICORN_SSL_CA_TYPE', italic=True, fg="magenta")}: {click.style(f'{ca_type}', bold=True, fg="yellow")}. 
Self-signed CAs are useful in testing or internal use cases, they’re not suitable for secure public internet communications.
        """)
        return

    if not os.path.isfile(cert_file_path):
        raise ValueError(f"SSL certificate file '{cert_file_path}' does not exist.")
    if not os.path.isfile(key_file_path):
        raise ValueError(f"SSL key file '{key_file_path}' does not exist.")

    try:
        context = ssl.create_default_context()
        context.load_cert_chain(certfile=cert_file_path, keyfile=key_file_path)
    except ssl.SSLError as e:
        raise ValueError(f"SSL Error: {e}")

    try:
        with open(cert_file_path, 'rb') as cert_file:
            cert_data = cert_file.read()
            cert = x509.load_pem_x509_certificate(cert_data, default_backend())

        if cert.issuer == cert.subject:
            raise ValueError("The certificate is self-signed and not issued by a trusted CA.")

    except Exception as e:
        raise ValueError(f"Certificate verification failed: {e}")


if __name__ == "__main__":
    # Do NOT change workers count for now
    # multi-workers support isn't implemented yet for APScheduler and XRay module
    _enforce_single_worker()

    bind_args = {}
    if UVICORN_SSL_CA_TYPE not in ["public", "private"]:
        UVICORN_SSL_CA_TYPE = "public"

    if UVICORN_SSL_CERTFILE and UVICORN_SSL_KEYFILE and UVICORN_SSL_CA_TYPE:
        validate_cert_and_key(UVICORN_SSL_CERTFILE, UVICORN_SSL_KEYFILE, UVICORN_SSL_CA_TYPE)

        bind_args['ssl_certfile'] = UVICORN_SSL_CERTFILE
        bind_args['ssl_keyfile'] = UVICORN_SSL_KEYFILE

        if UVICORN_UDS:
            bind_args['uds'] = UVICORN_UDS
        else:
            bind_args['host'] = UVICORN_HOST
            bind_args['port'] = UVICORN_PORT

    else:
        if UVICORN_UDS:
            bind_args['uds'] = UVICORN_UDS
        else:

            logger.warning(f"""
{click.style('IMPORTANT!', blink=True, bold=True, fg="yellow")}
You're running Marzban without specifying {click.style('UVICORN_SSL_CERTFILE', italic=True, fg="magenta")} and {click.style('UVICORN_SSL_KEYFILE', italic=True, fg="magenta")}.
The application will only be accessible through localhost. This means that {click.style('Marzban and subscription URLs will not be accessible externally', bold=True)}.

If you need external access, please provide the SSL files to allow the server to bind to 0.0.0.0. Alternatively, you can run the server on localhost or a Unix socket and use a reverse proxy, such as Nginx or Caddy, to handle SSL termination and provide external access.

If you wish to continue without SSL, you can use SSH port forwarding to access the application from your machine. note that in this case, subscription functionality will not work. 

Use the following command:

{click.style(f'ssh -L {UVICORN_PORT}:localhost:{UVICORN_PORT} user@server', italic=True, fg="cyan")}

Then, navigate to {click.style(f'http://127.0.0.1:{UVICORN_PORT}', bold=True)} on your computer.
            """)

            bind_args['host'] = '127.0.0.1'
            bind_args['port'] = UVICORN_PORT

    if DEBUG:
        bind_args['uds'] = None
        bind_args['host'] = '0.0.0.0'

    # Optional structured logging (LOG_FORMAT=json). Default `text`
    # preserves uvicorn's current human-readable output. Applied after
    # uvicorn would have configured its handlers — done from the
    # application side as the first request fires; here we apply it
    # eagerly so even pre-yield startup logs are JSON when requested.
    configure_logging(LOG_FORMAT)

    try:
        uvicorn.run(
            "main:app",
            **bind_args,
            workers=1,
            reload=DEBUG,
            log_level=logging.DEBUG if DEBUG else logging.INFO
        )
    except FileNotFoundError:  # to prevent error on removing unix sock
        pass
