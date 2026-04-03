# Smart DNS load balancing

Marzban can answer DNS queries for regional pool hostnames (for example `eu.vpn.example.com`), returning **one node public IP per query** using weighted random selection from nodes that report healthy metrics. Clients keep the same hostname in their subscription; when a node fails, short TTLs and the metrics poller steer new lookups to other nodes.

## Requirements

- **Single Marzban process** with Smart DNS enabled (do not run multiple Uvicorn workers; DNS and the poller use background threads).
- **Linux (or similar)**: binding to **UDP/TCP port 53** usually requires `CAP_NET_BIND_SERVICE` or root.
- **Marzban-node** (REST) exposes **`GET /metrics`** over the same mTLS port as the control API (`Node.port`, default `62050`).
- Nodes in a pool share the same **`smart_dns_name`** (FQDN). Optional **`smart_dns_announce_ip`** is the IPv4 returned to clients if it differs from the panel-to-node management address.

## Registrar / DNS delegation

1. Choose a hostname per region, e.g. `eu.vpn.example.com`.
2. At your DNS provider, create an **NS delegation** for that hostname (or a parent zone) pointing to the **Marzban host’s public IP** as the authoritative nameserver, **or** delegate to hostnames that resolve to that IP (glue records).
3. Set **`SMART_DNS_SOA_MNAME`** to a nameserver name you advertise (e.g. `ns1.eu.vpn.example.com.`) and ensure that name resolves to the panel IP.

## Panel configuration (`.env`)

| Variable | Description |
|----------|-------------|
| `SMART_DNS_ENABLED` | `true` to start the metrics poller and DNS servers. |
| `SMART_DNS_BIND_HOST` | Bind address (default `0.0.0.0`). |
| `SMART_DNS_PORT` | DNS port (default `53`). |
| `SMART_DNS_DEFAULT_TTL` | A/NS/SOA TTL in seconds (e.g. `10`). |
| `SMART_DNS_METRICS_INTERVAL` | Seconds between `GET /metrics` polls (e.g. `3`). |
| `SMART_DNS_METRICS_TIMEOUT` | Per-request timeout seconds. |
| `SMART_DNS_FAIL_THRESHOLD` | Consecutive failures before a node is excluded from answers. |
| `SMART_DNS_SCORE_BW_MULT` | Weight for `bandwidth_mbps` in score (default `0.7`). |
| `SMART_DNS_SCORE_CPU_MULT` | Weight for `cpu` in score (default `0.5`). |
| `SMART_DNS_RATE_LIMIT_QPS` | Max sustained DNS queries per second **per source IP** (`0` = disabled). |
| `SMART_DNS_SOA_MNAME` | Primary NS host for SOA (FQDN with trailing dot recommended). |
| `SMART_DNS_SOA_RNAME` | Hostmaster mailbox as FQDN (e.g. `hostmaster.example.com.`). |
| `SMART_DNS_SOA_SERIAL` | SOA serial (bump when you change zone semantics). |
| `SMART_DNS_ALERT_MAX_SCORE` | If `> 0`, dashboard alerts when node score ≥ this value. |
| `SMART_DNS_ALERT_MAX_CPU` | If `> 0`, alerts when reported CPU ≥ this. |
| `SMART_DNS_ALERT_MAX_BANDWIDTH_MBPS` | If `> 0`, alerts when reported Mbps ≥ this. |

## Docker

Grant bind permission on port 53, for example:

```yaml
cap_add:
  - NET_BIND_SERVICE
ports:
  - "53:53/udp"
  - "53:53/tcp"
```

## Node (Marzban-node)

- **`NODE_METRICS_INTERVAL`**: seconds between local metric samples (default `3`).
- Hysteria2: configure `trafficStats` with a reachable listen and the same secret as the panel’s `HYSTERIA2_TRAFFIC_SECRET` when using traffic-based metrics.
- **`HYSTERIA2_TRAFFIC_LISTEN`**: use `0.0.0.0:PORT`, or **`[::]:PORT`** for dual-stack bind (the node maps these to `127.0.0.1` for local HTTP). For a **specific IPv6** use **`[2001:db8::1]:PORT`** so the URL is formed correctly.
- Panel **node `address`**: if you store an IPv6 literal, you may use **`2001:db8::1`** or **`[2001:db8::1]`**; the Smart DNS poller normalizes it to **`https://[...]:port/metrics`**.
- **`/metrics`** is protected by the **same mTLS** as the REST control API (panel client certificate).

## TLS / SNI

Clients resolve the pool name to a **node IP** but often still present the **regional domain** as SNI. Use a certificate on each node that is valid for that name (e.g. a shared wildcard).

## Limitations

- **`active_connections`** on the node is derived from Hysteria traffic-map size when traffic stats are used; it is a proxy, not a raw TCP connection count.
- Smart DNS v1 is designed for a **single** Marzban worker process.
- Answers are **IPv4 `A` records only**. Put a valid IPv4 in **`smart_dns_announce_ip`** (or use the node `address` if it is already IPv4). **IPv6-only** client-facing addresses are not supported until `AAAA` is added.
- After HTTP failures, a node can still be treated as UP until **`SMART_DNS_FAIL_THRESHOLD`** consecutive failures; this reduces flapping but delays full exclusion by up to `(threshold − 1) × SMART_DNS_METRICS_INTERVAL` seconds.
- With **`SMART_DNS_ENABLED=false`**, the metrics poller does not run: the Smart DNS dashboard stays empty even if nodes have `smart_dns_name` set.
