import argparse
import socket
import sys


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check MTProto endpoint DNS resolution and TCP reachability."
    )
    parser.add_argument("host", help="Public MTProto host to verify")
    parser.add_argument("port", type=int, help="Public MTProto port to verify")
    parser.add_argument(
        "--expected-ip",
        action="append",
        default=[],
        dest="expected_ips",
        help="Expected resolved IP address. Repeat flag to allow several values.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=5.0,
        help="Socket timeout in seconds (default: 5)",
    )
    return parser.parse_args()


def resolve_host(host: str, port: int) -> list[str]:
    infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    addresses: list[str] = []
    for info in infos:
        ip = info[4][0]
        if ip not in addresses:
            addresses.append(ip)
    return addresses


def verify_expected_ips(resolved_ips: list[str], expected_ips: list[str]) -> bool:
    if not expected_ips:
        return True
    return any(ip in resolved_ips for ip in expected_ips)


def verify_tcp_connect(host: str, port: int, timeout: float) -> None:
    with socket.create_connection((host, port), timeout=timeout):
        return


def main() -> int:
    args = parse_args()

    try:
        resolved_ips = resolve_host(args.host, args.port)
    except OSError as exc:
        print(f"DNS resolution failed for {args.host}: {exc}")
        return 1

    print(f"Resolved {args.host} -> {', '.join(resolved_ips)}")

    if not verify_expected_ips(resolved_ips, args.expected_ips):
        print(
            "Resolved IPs do not match expected values: "
            + ", ".join(args.expected_ips)
        )
        return 1

    try:
        verify_tcp_connect(args.host, args.port, args.timeout)
    except OSError as exc:
        print(f"TCP connect failed for {args.host}:{args.port}: {exc}")
        return 1

    print(f"TCP connect succeeded for {args.host}:{args.port}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
